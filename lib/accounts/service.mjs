import { createRecoveryCodes, hashPassword, hashRecoveryCode, normalizeUsername, validPassword, verifyPassword } from './credentials.mjs';

const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const token = () => toHex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async value => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
const lifetime = 30 * 24 * 60 * 60 * 1000;

// These functions are server-only building blocks, not HTTP endpoints. Callers
// must implement rate limits, origin/CSRF checks and safe cookies first.
export async function registerPlayer(db, input, now = Date.now()) {
  const username = normalizeUsername(input?.username);
  const email = typeof input?.email === 'string' ? input.email.trim() : '';
  if (!username || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validPassword(input?.password) || input.password !== input.confirmation || input.accepted !== true) {
    throw new Error('INVALID_INPUT');
  }
  const passwordHash = await hashPassword(input.password);
  const id = crypto.randomUUID(), publicId = 'FD-' + toHex(crypto.getRandomValues(new Uint8Array(8))).toUpperCase();
  const codes = createRecoveryCodes(), hashes = await Promise.all(codes.map(hashRecoveryCode));
  const statements = [db.prepare('INSERT INTO player_accounts (id, public_id, username, username_key, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, publicId, username.display, username.normalized, email, passwordHash, now),
    db.prepare('INSERT INTO player_saves (account_id, updated_at) VALUES (?, ?)').bind(id, now),
    ...hashes.map(hash => db.prepare('INSERT INTO player_recovery_codes (code_hash, account_id, created_at) VALUES (?, ?, ?)').bind(hash, id, now))];
  await db.batch(statements);
  return { id, publicId, username: username.display, codes };
}

export async function verifyPlayer(db, usernameInput, password) {
  const username = normalizeUsername(usernameInput);
  if (!username || typeof password !== 'string') return null;
  const row = await db.prepare('SELECT id, password_hash FROM player_accounts WHERE username_key = ? AND disabled_at IS NULL').bind(username.normalized).first();
  if (!row || !await verifyPassword(password, row.password_hash)) return null;
  return row.id;
}

export async function createSession(db, accountId, now = Date.now()) {
  const raw = token(), hash = await digest(raw), expiresAt = now + lifetime;
  await db.prepare('INSERT INTO player_sessions (id_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(hash, accountId, now, expiresAt).run();
  return { token: raw, expiresAt };
}

export async function findSession(db, raw, now = Date.now()) {
  if (typeof raw !== 'string' || !/^[0-9a-f]{64}$/.test(raw)) return null;
  return await db.prepare('SELECT a.id, a.public_id, a.username, a.avatar FROM player_sessions s JOIN player_accounts a ON a.id = s.account_id WHERE s.id_hash = ? AND s.expires_at > ? AND a.disabled_at IS NULL').bind(await digest(raw), now).first();
}

export async function revokeSession(db, raw) {
  if (typeof raw !== 'string' || !/^[0-9a-f]{64}$/.test(raw)) return;
  await db.prepare('DELETE FROM player_sessions WHERE id_hash = ?').bind(await digest(raw)).run();
}

export async function revokeAllSessions(db, accountId) {
  await db.prepare('DELETE FROM player_sessions WHERE account_id = ?').bind(accountId).run();
}

export async function regenerateCodes(db, accountId, password, now = Date.now()) {
  const account = await db.prepare('SELECT password_hash FROM player_accounts WHERE id = ? AND disabled_at IS NULL').bind(accountId).first();
  if (!account || typeof password !== 'string' || !await verifyPassword(password, account.password_hash)) return null;
  const codes = createRecoveryCodes(), hashes = await Promise.all(codes.map(hashRecoveryCode));
  // Conditional statements also guard against a concurrent password change.
  await db.batch([
    db.prepare('DELETE FROM player_recovery_codes WHERE account_id = ? AND EXISTS (SELECT 1 FROM player_accounts WHERE id = ? AND password_hash = ? AND disabled_at IS NULL)').bind(accountId, accountId, account.password_hash),
    ...hashes.map(hash => db.prepare('INSERT INTO player_recovery_codes (code_hash, account_id, created_at) SELECT ?, id, ? FROM player_accounts WHERE id = ? AND password_hash = ? AND disabled_at IS NULL').bind(hash, now, accountId, account.password_hash)),
  ]);
  const found = await db.prepare('SELECT code_hash FROM player_recovery_codes WHERE account_id = ? AND code_hash = ?').bind(accountId, hashes[0]).first();
  return found ? codes : null;
}

export async function deletePlayer(db, accountId, password, confirmation) {
  if (confirmation !== 'SUPPRIMER' || typeof password !== 'string') return false;
  const account = await db.prepare('SELECT password_hash FROM player_accounts WHERE id = ? AND disabled_at IS NULL').bind(accountId).first();
  if (!account || !await verifyPassword(password, account.password_hash)) return false;
  // Foreign keys cascade to sessions, recovery codes, results and saves.
  // Matching the hash prevents a concurrent password change being bypassed.
  const result = await db.prepare('DELETE FROM player_accounts WHERE id = ? AND password_hash = ? RETURNING id').bind(accountId, account.password_hash).first();
  return !!result;
}

export async function updateProfile(db, accountId, input) {
  const username = normalizeUsername(input?.username);
  const email = typeof input?.email === 'string' ? input.email.trim() : '';
  if (!username || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_INPUT');
  const result = await db.prepare('UPDATE player_accounts SET username = ?, username_key = ?, email = ? WHERE id = ? AND disabled_at IS NULL RETURNING username, public_id, avatar').bind(username.display, username.normalized, email, accountId).first();
  return result ?? null;
}

export async function readProfile(db, accountId) {
  return await db.prepare('SELECT public_id, username, email, avatar, created_at, (SELECT count(*) FROM player_recovery_codes WHERE account_id = player_accounts.id) AS recovery_codes_remaining FROM player_accounts WHERE id = ? AND disabled_at IS NULL').bind(accountId).first();
}

export async function setAvatar(db, accountId, avatar) {
  if (!['soldier', 'commander', 'technician', 'agent', 'medic', 'scout', 'operator', 'core'].includes(avatar)) throw new Error('INVALID_INPUT');
  return await db.prepare('UPDATE player_accounts SET avatar = ? WHERE id = ? AND disabled_at IS NULL RETURNING avatar').bind(avatar, accountId).first();
}

export async function changePassword(db, accountId, currentPassword, newPassword) {
  if (!validPassword(newPassword) || typeof currentPassword !== 'string') return false;
  const row = await db.prepare('SELECT password_hash FROM player_accounts WHERE id = ? AND disabled_at IS NULL').bind(accountId).first();
  if (!row || !await verifyPassword(currentPassword, row.password_hash)) return false;
  const nextHash = await hashPassword(newPassword);
  const results = await db.batch([
    db.prepare('UPDATE player_accounts SET password_hash = ? WHERE id = ? AND password_hash = ? AND disabled_at IS NULL').bind(nextHash, accountId, row.password_hash),
    db.prepare('DELETE FROM player_sessions WHERE account_id = ? AND EXISTS (SELECT 1 FROM player_accounts WHERE id = ? AND password_hash = ?)').bind(accountId, accountId, nextHash),
  ]);
  return (results?.[0]?.meta?.changes ?? results?.[0]?.changes ?? 0) === 1;
}

// Compare-and-swap prevents an older device from silently replacing a newer save.
export async function updateSave(db, accountId, revision, data, now = Date.now()) {
  if (!Number.isSafeInteger(revision) || revision < 0 || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('INVALID_SAVE');
  const encoded = JSON.stringify(data);
  if (new TextEncoder().encode(encoded).length > 16384) throw new Error('SAVE_TOO_LARGE');
  const row = await db.prepare('UPDATE player_saves SET data = ?, revision = revision + 1, updated_at = ? WHERE account_id = ? AND revision = ? RETURNING revision').bind(encoded, now, accountId, revision).first();
  return row ? { saved: true, revision: row.revision } : { saved: false, conflict: true };
}

export async function readSave(db, accountId) {
  const row = await db.prepare('SELECT revision, data_version, data, updated_at FROM player_saves WHERE account_id = ?').bind(accountId).first();
  if (!row || row.data_version !== 1) return null;
  let data;
  try { data = JSON.parse(row.data); } catch { return null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return { revision: row.revision, dataVersion: row.data_version, updatedAt: row.updated_at, data };
}

// Fixed-window counter shared across requests and instances. The caller chooses
// a privacy-preserving bucket for each operation and client identifier.
export async function consumeAttempt(db, bucket, now, limit, windowMs) {
  if (typeof bucket !== 'string' || !bucket || bucket.length > 256 || !Number.isSafeInteger(now) || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1) throw new Error('INVALID_RATE_LIMIT');
  const row = await db.prepare(`INSERT INTO player_rate_limits (bucket, attempts, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(bucket) DO UPDATE SET
      attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    RETURNING attempts, expires_at`).bind(bucket, now + windowMs, now, now).first();
  return { allowed: row.attempts <= limit, retryAfter: Math.max(0, row.expires_at - now) };
}

// D1 executes batch statements in a transaction. The code is consumed in the
// same transaction as the password update and session invalidation.
export async function recoverPlayer(db, usernameInput, code, newPassword) {
  const username = normalizeUsername(usernameInput);
  const codeHash = await hashRecoveryCode(code);
  if (!username || !codeHash || !validPassword(newPassword)) return false;
  const passwordHash = await hashPassword(newPassword);
  const row = await db.prepare('SELECT id FROM player_accounts WHERE username_key = ? AND disabled_at IS NULL').bind(username.normalized).first();
  if (!row) return false;
  const result = await db.batch([
    db.prepare('UPDATE player_accounts SET password_hash = ? WHERE id = ? AND disabled_at IS NULL AND EXISTS (SELECT 1 FROM player_recovery_codes WHERE code_hash = ? AND account_id = ?)').bind(passwordHash, row.id, codeHash, row.id),
    db.prepare('DELETE FROM player_sessions WHERE account_id = ? AND EXISTS (SELECT 1 FROM player_accounts WHERE id = ? AND password_hash = ?)').bind(row.id, row.id, passwordHash),
    db.prepare('DELETE FROM player_recovery_codes WHERE code_hash = ? AND account_id = ? AND EXISTS (SELECT 1 FROM player_accounts WHERE id = ? AND password_hash = ?)').bind(codeHash, row.id, row.id, passwordHash),
  ]);
  return (result?.[0]?.meta?.changes ?? result?.[0]?.changes ?? 0) === 1;
}
