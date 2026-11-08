import { isSameOrigin, sessionCookie, clearSessionCookie } from './http-security.mjs';
import { consumeAttempt, registerPlayer, verifyPlayer, createSession, findSession, revokeSession, revokeAllSessions, recoverPlayer, updateSave, readSave, readProfile, updateProfile, changePassword, setAvatar, deletePlayer, regenerateCodes } from './service.mjs';

const reply = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const cookie = req => /(?:^|;\s*)__Host-fd_session=([0-9a-f]{64})(?:;|$)/.exec(req.headers.get('cookie') || '')?.[1] || '';
const sha = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');

async function boundedBody(request, limit) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
}

// clientId must be supplied by the hosting layer from a trusted source, never
// taken directly from a user-controlled HTTP header. Missing identity fails shut.
export async function handleAccountRequest(request, db, clientId, now = Date.now()) {
  if (!db || !clientId || typeof clientId !== 'string') return reply({ error: 'SERVICE_UNAVAILABLE' }, 503);
  const path = new URL(request.url).pathname.split('/').pop();
  if (request.method === 'GET' && path === 'export') {
    const session = await findSession(db, cookie(request), now);
    if (!session) return reply({ error: 'UNAUTHORIZED' }, 401);
    const profile = await readProfile(db, session.id);
    const save = await readSave(db, session.id);
    if (!profile) return reply({ error: 'UNAUTHORIZED' }, 401);
    return reply({ format: 'facility-defense-account', version: 1, exportedAt: new Date(now).toISOString(), profile, save }, 200, { 'content-disposition': 'attachment; filename="facility-defense-account.json"' });
  }
  if (request.method === 'GET' && path === 'session') {
    const profile = await findSession(db, cookie(request), now);
    return reply({ profile });
  }
  if (request.method === 'GET' && path === 'save') {
    const profile = await findSession(db, cookie(request), now);
    if (!profile) return reply({ error: 'UNAUTHORIZED' }, 401);
    const save = await readSave(db, profile.id);
    return save ? reply({ save }) : reply({ error: 'SAVE_UNAVAILABLE' }, 503);
  }
  if (request.method === 'GET' && path === 'profile') {
    const session = await findSession(db, cookie(request), now);
    if (!session) return reply({ error: 'UNAUTHORIZED' }, 401);
    const profile = await readProfile(db, session.id);
    return profile ? reply({ profile }) : reply({ error: 'UNAUTHORIZED' }, 401);
  }
  if (request.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!isSameOrigin(request)) return reply({ error: 'FORBIDDEN' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return reply({ error: 'INVALID_INPUT' }, 400);
  if (Number(request.headers.get('content-length') || 0) > 20000) return reply({ error: 'INVALID_INPUT' }, 413);
  const raw = await boundedBody(request, 20000);
  if (raw === null) return reply({ error: 'INVALID_INPUT' }, 413);
  let input; try { input = JSON.parse(raw); } catch { return reply({ error: 'INVALID_INPUT' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({ error: 'INVALID_INPUT' }, 400);
  if (['register', 'login', 'recover', 'password', 'delete', 'codes'].includes(path)) {
    const bucket = `${path}:${await sha(clientId)}`;
    const rate = await consumeAttempt(db, bucket, now, path === 'register' ? 5 : 10, 15 * 60 * 1000);
    if (!rate.allowed) return reply({ error: 'RATE_LIMITED' }, 429, { 'retry-after': String(Math.ceil(rate.retryAfter / 1000)) });
  }
  try {
    if (path === 'register') {
      const player = await registerPlayer(db, input, now);
      return reply({ publicId: player.publicId, username: player.username, codes: player.codes }, 201);
    }
    if (path === 'login') {
      const id = await verifyPlayer(db, input.username, input.password);
      if (!id) return reply({ error: 'INVALID_CREDENTIALS' }, 401);
      const session = await createSession(db, id, now);
      return reply({ ok: true }, 200, { 'set-cookie': sessionCookie(session.token, 2592000) });
    }
    if (path === 'recover') {
      if (input.password !== input.confirmation || !await recoverPlayer(db, input.username, input.code, input.password)) return reply({ error: 'INVALID_CREDENTIALS' }, 400);
      return reply({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
    }
    const rawSession = cookie(request), profile = await findSession(db, rawSession, now);
    if (!profile) return reply({ error: 'UNAUTHORIZED' }, 401);
    if (path === 'codes') {
      const codes = await regenerateCodes(db, profile.id, input.password, now);
      return codes ? reply({ codes }) : reply({ error: 'INVALID_CREDENTIALS' }, 400);
    }
    if (path === 'delete') {
      if (!await deletePlayer(db, profile.id, input.password, input.confirmation)) return reply({ error: 'INVALID_CREDENTIALS' }, 400);
      return reply({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
    }
    if (path === 'logout') { await revokeSession(db, rawSession); return reply({ ok: true }, 200, { 'set-cookie': clearSessionCookie() }); }
    if (path === 'logout-all') { await revokeAllSessions(db, profile.id); return reply({ ok: true }, 200, { 'set-cookie': clearSessionCookie() }); }
    if (path === 'password') {
      if (input.password !== input.confirmation || !await changePassword(db, profile.id, input.currentPassword, input.password)) return reply({ error: 'INVALID_CREDENTIALS' }, 400);
      return reply({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
    }
    if (path === 'profile') {
      const updated = await updateProfile(db, profile.id, input);
      return updated ? reply({ profile: updated }) : reply({ error: 'UNAUTHORIZED' }, 401);
    }
    if (path === 'avatar') { const avatar = await setAvatar(db, profile.id, input.avatar); return avatar ? reply({ avatar: avatar.avatar }) : reply({ error: 'UNAUTHORIZED' }, 401); }
    if (path === 'save') {
      if (input.owner !== undefined && input.owner !== profile.public_id) return reply({ error: 'ACCOUNT_CHANGED' }, 409);
      const result = await updateSave(db, profile.id, input.revision, input.data, now);
      return reply(result, result.saved ? 200 : 409);
    }
    return reply({ error: 'NOT_FOUND' }, 404);
  } catch (error) {
    if (error?.message === 'INVALID_INPUT' || error?.message === 'INVALID_SAVE' || error?.message === 'SAVE_TOO_LARGE') return reply({ error: 'INVALID_INPUT' }, 400);
    if (String(error?.message || '').includes('UNIQUE constraint failed')) return reply({ error: 'REQUEST_FAILED' }, 409);
    console.error('ACCOUNT_OPERATION_FAILED', path, error instanceof Error ? error.name : 'UnknownError');
    return reply({ error: 'SERVICE_UNAVAILABLE' }, 503);
  }
}
