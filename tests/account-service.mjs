import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { registerPlayer, verifyPlayer, createSession, findSession, revokeSession, revokeAllSessions, recoverPlayer, consumeAttempt, updateSave, changePassword, deletePlayer, regenerateCodes, readProfile } from '../lib/accounts/service.mjs';
import { handleAccountRequest } from '../lib/accounts/http-handler.mjs';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_great_shen.sql', import.meta.url), 'utf8'));
  const db = { prepare(sql) { return { bind(...args) { return { run: async () => sqlite.prepare(sql).run(...args), first: async () => sqlite.prepare(sql).get(...args) ?? null }; } }; },
    async batch(stmts) { sqlite.exec('BEGIN'); try { const results = []; for (const stmt of stmts) results.push(await stmt.run()); sqlite.exec('COMMIT'); return results; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };
  return { db, sqlite };
}
const input = { username: 'Soldat', email: 'player@example.test', password: 'mot de passe très long', confirmation: 'mot de passe très long', accepted: true };

test('regeneration requires a password and replaces all eight recovery codes', async () => {
  const { db, sqlite } = database();
  const player = await registerPlayer(db, input, 100);
  assert.equal(await regenerateCodes(db, player.id, 'wrong', 101), null);
  const codes = await regenerateCodes(db, player.id, input.password, 102);
  assert.equal(codes.length, 8);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM player_recovery_codes WHERE account_id=?').get(player.id).n, 8);
  assert.equal(await recoverPlayer(db, input.username, player.codes[0], 'un nouveau mot de passe'), false);
  assert.equal(await recoverPlayer(db, input.username, codes[0], 'un nouveau mot de passe'), true);
  assert.equal((await readProfile(db, player.id)).recovery_codes_remaining, 7);
});

test('deletion requires confirmation and password and removes related private records', async () => {
  const { db, sqlite } = database();
  const player = await registerPlayer(db, input, 100);
  const session = await createSession(db, player.id, 100);
  assert.equal(await deletePlayer(db, player.id, input.password, ''), false);
  assert.equal(await deletePlayer(db, player.id, 'wrong', 'SUPPRIMER'), false);
  assert.ok(await findSession(db, session.token, 101));
  assert.equal(await deletePlayer(db, player.id, input.password, 'SUPPRIMER'), true);
  assert.equal(await findSession(db, session.token, 101), null);
  for (const table of ['player_accounts','player_sessions','player_recovery_codes','player_saves']) assert.equal(sqlite.prepare('SELECT count(*) AS n FROM '+table).get().n, 0);
});

test('password changes require the old password and revoke all sessions', async () => {
  const { db } = database();
  const player = await registerPlayer(db, input, 100);
  const session = await createSession(db, player.id, 100);
  assert.equal(await changePassword(db, player.id, 'wrong', 'une nouvelle phrase secrète'), false);
  assert.ok(await findSession(db, session.token, 101));
  assert.equal(await changePassword(db, player.id, input.password, 'une nouvelle phrase secrète'), true);
  assert.equal(await findSession(db, session.token, 101), null);
  assert.equal(await verifyPlayer(db, input.username, 'une nouvelle phrase secrète'), player.id);
  assert.equal(await verifyPlayer(db, input.username, input.password), null);
});

test('HTTP account actions enforce origin, limits, sessions and save conflicts', async () => {
  const { db } = database();
  const send = (path, body, extra = {}) => handleAccountRequest(new Request('https://game.example/api/account/' + path, { method: 'POST', headers: { origin: 'https://game.example', 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) }), db, 'trusted-client', 100);
  assert.equal((await send('register', input, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await send('register', input)).status, 201);
  const login = await send('login', { username: input.username, password: input.password });
  assert.equal(login.status, 200);
  const session = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await send('save', { owner: 'ANOTHER_ACCOUNT', revision: 0, data: {} }, { cookie: session })).status, 409);
  const exported = await handleAccountRequest(new Request('https://game.example/api/account/export', { headers: { cookie: session } }), db, 'trusted-client', 100);
  assert.equal(exported.status, 200);
  const exportText = await exported.text();
  assert.ok(!exportText.includes('password_hash'));
  assert.ok(!exportText.includes('code_hash'));
  const anonymousExport = await handleAccountRequest(new Request('https://game.example/api/account/export'), db, 'trusted-client', 100);
  assert.equal(anonymousExport.status, 401);
  assert.equal((await send('avatar', { avatar: 'medic' }, { cookie: session })).status, 200);
  assert.equal((await send('avatar', { avatar: '../invalid' }, { cookie: session })).status, 400);
  assert.equal((await send('profile', { username: 'Commandant', email: 'new@example.test' }, { cookie: session })).status, 200);
  const profile = await handleAccountRequest(new Request('https://game.example/api/account/profile', { headers: { cookie: session } }), db, 'trusted-client', 100);
  const profileData = (await profile.json()).profile;
  assert.equal(profileData.username, 'Commandant');
  assert.equal(profileData.avatar, 'medic');
  assert.equal((await send('save', { revision: 0, data: { best: 2 } }, { cookie: session })).status, 200);
  const saved = await handleAccountRequest(new Request('https://game.example/api/account/save', { headers: { cookie: session } }), db, 'trusted-client', 100);
  assert.equal((await saved.json()).save.data.best, 2);
  assert.equal((await send('save', { revision: 0, data: { best: 1 } }, { cookie: session })).status, 409);
  assert.equal((await send('logout', {}, { cookie: session })).status, 200);
  assert.equal((await send('save', { revision: 1, data: {} }, { cookie: session })).status, 401);
  for (let i = 0; i < 9; i++) await send('login', { username: input.username, password: 'wrong' });
  assert.equal((await send('login', { username: input.username, password: 'wrong' })).status, 429);
});

test('save revisions reject stale writes and isolate player accounts', async () => {
  const { db, sqlite } = database();
  const a = await registerPlayer(db, input, 100);
  const b = await registerPlayer(db, { ...input, username: 'Medic' }, 100);
  assert.deepEqual(await updateSave(db, a.id, 0, { best: 15 }, 101), { saved: true, revision: 1 });
  assert.deepEqual(await updateSave(db, a.id, 0, { best: 2 }, 102), { saved: false, conflict: true });
  assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM player_saves WHERE account_id=?').get(a.id).data).best, 15);
  assert.equal(sqlite.prepare('SELECT revision FROM player_saves WHERE account_id=?').get(b.id).revision, 0);
  await assert.rejects(updateSave(db, a.id, 1, { x: 'x'.repeat(17000) }));
});

test('attempt limits persist, isolate buckets and reset after expiration', async () => {
  const { db } = database();
  assert.equal((await consumeAttempt(db, 'login:a', 100, 2, 1000)).allowed, true);
  assert.equal((await consumeAttempt(db, 'login:a', 101, 2, 1000)).allowed, true);
  assert.equal((await consumeAttempt(db, 'login:a', 102, 2, 1000)).allowed, false);
  assert.equal((await consumeAttempt(db, 'login:b', 102, 2, 1000)).allowed, true);
  assert.equal((await consumeAttempt(db, 'login:a', 1100, 2, 1000)).allowed, true);
});

test('registration is persistent, case insensitive and rolls back duplicates', async () => {
  const { db, sqlite } = database();
  const player = await registerPlayer(db, input, 100);
  assert.equal(player.codes.length, 8);
  assert.equal(await verifyPlayer(db, 'soldat', input.password), player.id);
  assert.equal(await verifyPlayer(db, 'soldat', 'wrong password'), null);
  await assert.rejects(registerPlayer(db, { ...input, username: 'SOLDAT' }, 101));
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM player_accounts').get().n, 1);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM player_recovery_codes').get().n, 8);
  assert.ok(!JSON.stringify(sqlite.prepare('SELECT * FROM player_recovery_codes').all()).includes(player.codes[0]));
});

test('recovery consumes a code exactly once and revokes old sessions', async () => {
  const { db } = database();
  const player = await registerPlayer(db, input, 100);
  const session = await createSession(db, player.id, 100);
  assert.equal(await recoverPlayer(db, 'soldat', player.codes[0], 'nouveau mot de passe sûr'), true);
  assert.equal(await findSession(db, session.token, 101), null);
  assert.equal(await verifyPlayer(db, 'soldat', 'nouveau mot de passe sûr'), player.id);
  assert.equal(await recoverPlayer(db, 'soldat', player.codes[0], 'encore une autre phrase'), false);
});

test('sessions expire and can be revoked individually or together', async () => {
  const { db } = database();
  const player = await registerPlayer(db, input, 100);
  const a = await createSession(db, player.id, 100), b = await createSession(db, player.id, 100);
  assert.equal((await findSession(db, a.token, 101)).id, player.id);
  assert.equal(await findSession(db, a.token, a.expiresAt), null);
  await revokeSession(db, a.token);
  assert.equal(await findSession(db, a.token, 101), null);
  assert.ok(await findSession(db, b.token, 101));
  await revokeAllSessions(db, player.id);
  assert.equal(await findSession(db, b.token, 101), null);
});
