// Account mutations require an exact same-origin request. This module must be
// used by every account endpoint before reading credentials or changing state.
export function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    return source.origin === target.origin && source.pathname === '/' && !source.search && !source.hash;
  } catch { return false; }
}

export function sessionCookie(token, maxAge) {
  if (!/^[0-9a-f]{64}$/.test(token) || !Number.isInteger(maxAge) || maxAge < 0 || maxAge > 2592000) throw new Error('Invalid session cookie');
  return `__Host-fd_session=${token}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=None; Partitioned`;
}

export const clearSessionCookie = () => '__Host-fd_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=None; Partitioned';
