// Session auth shared by middleware (edge) and API routes (node).
// Uses Web Crypto only, so it runs in both runtimes.

export const COOKIE = 'cm_session';
export const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(s + '==='.slice((s.length + 3) % 4));
}

// Changing APP_PASSWORD (or AUTH_SECRET) signs everyone out.
function secret() {
  const pw = process.env.APP_PASSWORD || '';
  if (!pw) return null;
  return (process.env.AUTH_SECRET || 'creator-mailer') + '|' + pw;
}

async function hmacKey() {
  const s = secret();
  if (!s) return null;
  return crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(text) {
  const key = await hmacKey();
  if (!key) return null;
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

// Constant-time compare via SHA-256 digests (equal length regardless of input).
export async function safeEqual(a, b) {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ]);
  const x = new Uint8Array(da), y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function authConfigured() {
  return !!process.env.APP_PASSWORD;
}

export async function checkCredentials(username, password) {
  const U = (process.env.APP_USERNAME || 'admin').trim().toLowerCase();
  const P = process.env.APP_PASSWORD || '';
  if (!P) return false;
  const [u, p] = await Promise.all([
    safeEqual(String(username || '').trim().toLowerCase(), U),
    safeEqual(String(password || ''), P),
  ]);
  return u && p;
}

export async function createToken(username) {
  const payload = b64url(enc.encode(JSON.stringify({ u: username, exp: Date.now() + MAX_AGE * 1000 })));
  const sig = await sign(payload);
  return payload + '.' + sig;
}

export async function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = await sign(payload);
    if (!expected || !(await safeEqual(expected, sig))) return null;
    const data = JSON.parse(fromB64url(payload));
    if (!data || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// For API routes: returns the session or null.
export async function getSession(request) {
  return verifyToken(request.cookies.get(COOKIE)?.value);
}

export function cookieOptions(maxAge = MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}
