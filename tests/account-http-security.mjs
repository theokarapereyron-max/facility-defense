import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSameOrigin, sessionCookie, clearSessionCookie } from '../lib/accounts/http-security.mjs';

test('account mutations reject missing, forged and cross-origin requests', () => {
  const req = origin => new Request('https://game.example/api/account', { headers: origin ? { origin } : {} });
  assert.equal(isSameOrigin(req('https://game.example')), true);
  for (const origin of [null, 'null', 'https://evil.example', 'http://game.example', 'https://game.example.evil.example']) assert.equal(isSameOrigin(req(origin)), false);
});
test('session cookies are host-only, secure, inaccessible to JavaScript and bounded', () => {
  const cookie = sessionCookie('ab'.repeat(32), 2592000);
  for (const flag of ['__Host-fd_session=', 'Secure', 'HttpOnly', 'SameSite=None', 'Partitioned', 'Path=/']) assert.ok(cookie.includes(flag));
  assert.throws(() => sessionCookie('bad', 1));
  assert.throws(() => sessionCookie('ab'.repeat(32), 2592001));
  assert.ok(clearSessionCookie().includes('Max-Age=0'));
});
