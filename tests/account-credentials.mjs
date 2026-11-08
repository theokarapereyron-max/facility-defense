import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryCodes, hashPassword, hashRecoveryCode, normalizeUsername, validPassword, verifyPassword } from '../lib/accounts/credentials.mjs';

test('usernames normalize consistently and reject unsafe or reserved names', () => {
  assert.equal(normalizeUsername('Éclaireur').normalized, normalizeUsername('E\u0301CLAIREUR').normalized);
  for (const name of ['admin', 'a b', 'ab', 'invisible\u200b', '<script>']) assert.equal(normalizeUsername(name), null);
});
test('passwords are salted and can be verified without accepting malformed hashes', async () => {
  assert.equal(validPassword('too short'), false);
  const password = 'une phrase secrète longue';
  const a = await hashPassword(password), b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword('un autre mot de passe', a), false);
  assert.equal(await verifyPassword(password, 'pbkdf2-sha256$1$00$00'), false);
});
test('recovery codes contain 128 bits, are distinct and hash consistently', async () => {
  const codes = createRecoveryCodes();
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  for (const code of codes) assert.match(code, /^[0-9a-f]{32}$/);
  assert.equal(await hashRecoveryCode(codes[0]), await hashRecoveryCode(codes[0].toUpperCase()));
  assert.equal(await hashRecoveryCode('123456'), null);
});
