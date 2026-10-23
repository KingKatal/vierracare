const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[auth] SESSION_SECRET is not set — admin sessions will reset on every restart/instance. Set it in your environment.');
}

let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = crypto.randomBytes(9).toString('base64url');
  console.warn(`[auth] ADMIN_PASSWORD is not set. Temporary admin password for this process only: ${ADMIN_PASSWORD}`);
  if (process.env.VERCEL) {
    console.warn('[auth] On Vercel this password only works for one instance. Set ADMIN_PASSWORD and SESSION_SECRET in Project Settings → Environment Variables.');
  }
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

function check(user, pass) { return eq(user, ADMIN_USER) & eq(pass, ADMIN_PASSWORD) ? true : false; }

function issue(res) {
  const body = Buffer.from(JSON.stringify({ u: ADMIN_USER, exp: Date.now() + TTL })).toString('base64url');
  res.cookie(COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: TTL, path: '/'
  });
}
function clear(res) { res.clearCookie(COOKIE, { path: '/' }); }

function valid(req) {
  const raw = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [body, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!body || !sig || !eq(sig, sign(body))) return false;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
function require_(req, res, next) { return valid(req) ? next() : res.status(401).json({ error: 'Not signed in' }); }

module.exports = { check, issue, clear, valid, require: require_ };
