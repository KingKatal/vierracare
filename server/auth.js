// Signed-cookie admin session. Set ADMIN_PASSWORD and SESSION_SECRET in the
// Netlify environment so sessions work across every function instance.
import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[auth] SESSION_SECRET is not set — admin sessions will reset on every cold start. Set it in your Netlify environment variables.');
}

// Without ADMIN_PASSWORD, admin sign-in is disabled rather than falling back to
// a temporary password that would differ between function instances.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.warn('[auth] ADMIN_PASSWORD is not set — admin sign-in is disabled. Set it in your Netlify environment variables.');
}
const ADMIN_USER = process.env.ADMIN_USER || 'admin';

const eq = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');

const COOKIE = 'vierra_admin';
const TTL = 1000 * 60 * 60 * 8; // 8 hours

export function check(user, pass) {
  if (!ADMIN_PASSWORD) return false;
  return eq(user, ADMIN_USER) & eq(pass, ADMIN_PASSWORD) ? true : false;
}

// Returns a Set-Cookie header value for a fresh session.
export function issue() {
  const body = Buffer.from(JSON.stringify({ u: ADMIN_USER, exp: Date.now() + TTL })).toString('base64url');
  return `${COOKIE}=${body}.${sign(body)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL / 1000}; Secure`;
}
export function clear() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure`;
}

export function valid(req) {
  const raw = (req.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [body, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!body || !sig || !eq(sig, sign(body))) return false;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
