import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

// Stateless credential helpers. Persistence, rate limiting and transactions are
// deliberately the responsibility of the server-side account service.
const encoder = new TextEncoder();
const ITERATIONS = 600_000;
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const unhex = value => {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error('Invalid encoding');
  return Uint8Array.from(value.match(/../g), byte => parseInt(byte, 16));
};
const random = length => crypto.getRandomValues(new Uint8Array(length));

export function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && encoder.encode(password).length <= 1024;
}

export function normalizeUsername(value) {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFC');
  if (!/^[\p{L}\p{N}_-]{3,20}$/u.test(name)) return null;
  const normalized = name.toLocaleLowerCase('und').normalize('NFC');
  if (['admin', 'administrator', 'system', 'support', 'moderator'].includes(normalized)) return null;
  return { display: name, normalized };
}

async function derive(password, salt, iterations) {
  // Standard PBKDF2-SHA256 without the platform's capped native implementation.
  return pbkdf2Async(sha256, encoder.encode(password), salt, { c: iterations, dkLen: 32 });
}

export async function hashPassword(password) {
  if (!validPassword(password)) throw new Error('Invalid password');
  const salt = random(16);
  return `pbkdf2-sha256$${ITERATIONS}$${hex(salt)}$${hex(await derive(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || encoder.encode(password).length > 1024 || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256' || !/^\d+$/.test(parts[1])) return false;
  const iterations = Number(parts[1]);
  if (iterations < ITERATIONS || iterations > 2_000_000 || !/^[0-9a-f]{32}$/.test(parts[2]) || !/^[0-9a-f]{64}$/.test(parts[3])) return false;
  const actual = await derive(password, unhex(parts[2]), iterations), expected = unhex(parts[3]);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function createRecoveryCodes() {
  return Array.from({ length: 8 }, () => hex(random(16)));
}

export async function hashRecoveryCode(code) {
  if (typeof code !== 'string' || !/^[0-9a-f]{32}$/i.test(code)) return null;
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', unhex(code))));
}
