require('./env');

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const site = require('../config/site');
const store = require('./db');
const auth = require('./auth');
const { notify } = require('./mailer');
const { PAGES, page, notFound } = require('./render');

const app = express();
const PROD = process.env.NODE_ENV === 'production';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'font-src': ["'self'"],
      'frame-src': ["'self'", 'https://www.google.com'],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': PROD ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: '30kb' }));

// ── Static assets ───────────────────────────────────────────
app.use(express.static(PUBLIC_DIR, {
  maxAge: PROD ? '7d' : 0,
  index: false,
  extensions: ['html'],
  setHeaders(res, filePath) {
    // Font files never change in place; cache them for a year.
    if (filePath.split(path.sep).includes('fonts')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// ── Public pages ────────────────────────────────────────────
for (const route of Object.keys(PAGES)) {
  app.get(route, (req, res) => res.type('html').send(page(route)));
}
app.get('/robots.txt', (req, res) => res.type('text').send(
  `User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${site.url}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const urls = Object.keys(PAGES).map(r => `<url><loc>${site.url}${r === '/' ? '' : r}</loc></url>`).join('');
  res.type('xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

// ── Form API ────────────────────────────────────────────────
// Note: the rate limiter is per serverless instance. It is still useful as a
// best-effort guard, but for strict global limits use Vercel WAF or Upstash.
const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again in a few minutes.' } });

const clean = (v, max = 500) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\-.\s\d]{6,25}$/;
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

function handle(type, build) {
  return [formLimiter, async (req, res) => {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true }); // honeypot — silently drop bots
    try {
      const { name, email, phone, payload } = build(b);
      if (name.length < 2) throw badRequest('Please enter your name.');
      if (!email && !phone) throw badRequest('Please give us an email address or phone number.');
      if (email && !EMAIL.test(email)) throw badRequest('That email address doesn’t look right.');
      if (phone && !PHONE.test(phone)) throw badRequest('That phone number doesn’t look right.');
      const id = await store.add({ type, name, email, phone, payload, ip: req.ip });
      // Awaited so the email is not lost when a serverless invocation ends.
      await notify({ id, type, name, email, phone, payload });
      res.json({ ok: true, id });
    } catch (e) {
      if (e.status === 400) return res.status(400).json({ error: e.message });
      console.error('[form]', type, e);
      res.status(500).json({ error: 'We could not save your message. Please try again or call us.' });
    }
  }];
}

const SERVICES = ['Nursing care (RN / LPN)', 'Personal care & daily living', 'Companionship', 'Respite for family', 'Post-hospital transition', 'Private nursing support', 'Not sure yet'];
const ROLES = ['Registered Nurse (RN)', 'Licensed Practical Nurse (LPN)', 'Health Care Aide (HCA)', 'Personal support worker', 'Companion / caregiver', 'Other'];

app.post('/api/contact', ...handle('contact', b => ({
  name: clean(b.name, 100), email: clean(b.email, 150), phone: clean(b.phone, 25),
  payload: { subject: clean(b.subject, 120), message: clean(b.message, 3000) }
})));

app.post('/api/care-request', ...handle('care_request', b => {
  if (!b.consent) throw badRequest('Please tick the box so we can contact you about your request.');
  return {
    name: clean(b.name, 100), email: clean(b.email, 150), phone: clean(b.phone, 25),
    payload: {
      relationship: clean(b.relationship, 60), careFor: clean(b.careFor, 100),
      location: clean(b.location, 150),
      services: (Array.isArray(b.services) ? b.services : []).map(s => clean(s, 60)).filter(s => SERVICES.includes(s)),
      schedule: clean(b.schedule, 60), startDate: clean(b.startDate, 40),
      contactPreference: clean(b.contactPreference, 30), notes: clean(b.notes, 3000)
    }
  };
}));

app.post('/api/apply', ...handle('application', b => {
  if (!b.consent) throw badRequest('Please confirm that you agree to us storing your application.');
  const role = clean(b.role, 60);
  if (!ROLES.includes(role)) throw badRequest('Please choose the role you are applying for.');
  return {
    name: clean(b.name, 100), email: clean(b.email, 150), phone: clean(b.phone, 25),
    payload: { role, experience: clean(b.experience, 40), licence: clean(b.licence, 120),
      availability: clean(b.availability, 80), message: clean(b.message, 3000) }
  };
}));

// ── Admin API ───────────────────────────────────────────────
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: 'Too many attempts. Try later.' } });

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!auth.check(clean(username, 60), clean(password, 200))) return res.status(401).json({ error: 'Incorrect username or password.' });
  auth.issue(res); res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { auth.clear(res); res.json({ ok: true }); });
app.get('/api/admin/me', (req, res) => res.json({ signedIn: auth.valid(req) }));

app.get('/api/admin/inquiries', auth.require, async (req, res) => {
  const { type, status, q } = req.query;
  const [stats, items] = await Promise.all([
    store.stats(),
    store.list({
      type: ['contact', 'care_request', 'application'].includes(type) ? type : '',
      status: ['new', 'in_progress', 'done'].includes(status) ? status : '', q: clean(q, 80)
    })
  ]);
  res.json({ stats, items });
});
app.patch('/api/admin/inquiries/:id', auth.require, async (req, res) => {
  const { status, notes } = req.body || {};
  await store.update(Number(req.params.id), { status: ['new', 'in_progress', 'done'].includes(status) ? status : undefined, notes });
  res.json({ ok: true });
});
app.delete('/api/admin/inquiries/:id', auth.require, async (req, res) => {
  await store.remove(Number(req.params.id));
  res.json({ ok: true });
});
app.get('/api/admin/export.csv', auth.require, async (req, res) => {
  const q = v => { let x = String(v ?? ''); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return `"${x.replace(/"/g, '""')}"`; }; // blocks spreadsheet formula injection
  const rows = await store.list({ limit: 100000 });
  const csv = ['id,received,type,status,name,email,phone,details,notes',
    ...rows.map(r => [r.id, r.created_at, r.type, r.status, r.name, r.email, r.phone,
      Object.entries(r.payload).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : v}`).join(' | '), r.notes].map(q).join(','))].join('\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="vierra-inquiries.csv"' }).send('﻿' + csv);
});

// ── Admin UI (not indexed, not in sitemap) ──────────────────
app.get('/admin', (req, res) => {
  res.set('X-Robots-Tag', 'noindex').sendFile(path.join(__dirname, '..', 'views', 'admin.html'));
});

app.get('/healthz', (req, res) => res.json({ ok: true, db: store.mode }));

// ── 404 / errors ────────────────────────────────────────────
app.use((req, res) => res.status(404).type('html').send(notFound()));
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api/')) return res.status(err.status || 500).json({ error: 'Something went wrong. Please try again.' });
  res.status(500).type('text').send('Something went wrong.');
});

module.exports = app;
