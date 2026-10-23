// Tiny template engine: layout + page + partials, cached in production.
const fs = require('fs');
const path = require('path');
const site = require('../config/site');

const V = path.join(__dirname, '..', 'views');
const read = f => fs.readFileSync(path.join(V, f), 'utf8');
const cache = new Map();
const PROD = process.env.NODE_ENV === 'production';

const PAGES = {
  '/':               { file: 'home',     title: 'Compassionate Home Care & Nursing',      desc: 'Vierra Care Services provides registered nurses, health care aides and caring companions to look after seniors and families in the comfort of home.', nav: 'home' },
  '/about':          { file: 'about',    title: 'About Us',                                desc: 'Meet Vierra Care Services — a nurse-led home care team founded by Agatha Gondwe, RN, built on compassion, dignity and peace of mind.', nav: 'about' },
  '/services':       { file: 'services', title: 'Our Care Services',                       desc: 'Nursing care, personal support, companionship, respite and post-hospital transition care delivered at home by Vierra Care Services.', nav: 'services' },
  '/request-care':   { file: 'request',  title: 'Request Care',                            desc: 'Tell us about the care you need. Our team will respond personally to arrange a free, no-obligation conversation.', nav: 'request' },
  '/careers':        { file: 'careers',  title: 'Careers — Join Our Care Team',            desc: 'Nurses, health care aides and caregivers: join a team that puts compassion first. Apply to Vierra Care Services.', nav: 'careers' },
  '/faq':            { file: 'faq',      title: 'Frequently Asked Questions',              desc: 'Answers about home care, how to get started, who we care for, and what to expect from Vierra Care Services.', nav: 'faq' },
  '/contact':        { file: 'contact',  title: 'Contact Us',                              desc: 'Contact Vierra Care Services by phone, WhatsApp, email or the form. We are glad to help.', nav: 'contact' },
  '/privacy':        { file: 'privacy',  title: 'Privacy Policy',                          desc: 'How Vierra Care Services collects, uses and protects your information.', nav: '' }
};

function fill(tpl, ctx) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), ctx);
    return v == null ? '' : String(v);
  });
}
function partial(name) { return read(`partials/${name}.html`); }

function page(route) {
  const key = route;
  if (PROD && cache.has(key)) return cache.get(key);
  const meta = PAGES[route];
  const ctx = { site, page: { ...meta, canonical: site.url + (route === '/' ? '' : route) } };
  const nav = (id) => (meta.nav === id ? ' aria-current="page"' : '');
  const content = fill(read(`pages/${meta.file}.html`), ctx);
  let html = read('layout.html')
    .replace('{{> header}}', partial('header'))
    .replace('{{> footer}}', partial('footer'))
    .replace('{{> content}}', content);
  html = html.replace(/\{\{nav:(\w+)\}\}/g, (_, id) => nav(id));
  html = fill(html, ctx);
  const full = route === '/' ? `${site.name} — ${site.tagline}` : `${meta.title} · ${site.name}`;
  html = html.replace('<!--TITLE-->', full.replace(/</g, '&lt;'));
  if (PROD) cache.set(key, html);
  return html;
}

function notFound() {
  const ctx = { site, page: { title: 'Page not found', desc: 'Page not found', canonical: site.url } };
  let html = read('layout.html')
    .replace('{{> header}}', partial('header'))
    .replace('{{> footer}}', partial('footer'))
    .replace('{{> content}}', fill(read('pages/404.html'), ctx))
    .replace(/\{\{nav:(\w+)\}\}/g, '');
  html = fill(html, ctx).replace('<!--TITLE-->', `Page not found · ${site.name}`)
    .replace('</head>', '<meta name="robots" content="noindex"></head>');
  return html;
}

module.exports = { PAGES, page, notFound };
