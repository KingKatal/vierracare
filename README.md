# Vierra Care Services — Website

Full-stack site: Node.js + Express backend, SQLite database, server-rendered multi-page frontend with custom animations (no framework, fast on mobile data).

## Run it
```bash
npm install
cp .env.example .env     # then edit it
npm start                # http://localhost:3000
```
Needs **Node 22.13+**. No separate database server needed.

## Before going live (important)
1. **Edit `config/site.js`**: phone, WhatsApp number, email, address, hours, social links. Every page updates.
2. **Set `.env`**: `ADMIN_PASSWORD`, `SESSION_SECRET`, `SITE_URL`.
3. Replace `public/img/hero-portrait.jpg` and `hero-wide.jpg` with high-resolution photos (current ones were cropped from the flyer/banner, so they are low resolution).
4. Have the privacy policy (`views/pages/privacy.html`) reviewed for your country's rules.
5. Add real client testimonials only once you have permission from real clients.

## Pages
Home · About · Services · Request Care (3-step form) · Careers (application form) · FAQ · Contact · Privacy · 404

## Admin inbox — `/admin`
Care requests, messages and job applications. Set status (New / In progress / Done), add private notes, search, filter, delete, export CSV.

## Email alerts (optional)
Fill in the `SMTP_*` variables. Without them, submissions are still saved and visible in `/admin`.

## Deploy
Any host that runs Node (Render, Railway, Fly.io, or a VPS with Nginx + PM2).
- Set `NODE_ENV=production` and the variables above.
- Keep `data/` on persistent storage (it holds `vierra.db`) and back it up.
- Point the domain at the host and enable HTTPS.

## Structure
config/site.js (business details) · server/ (routes, db, auth, mailer, templating) · views/ (layout, partials, pages, admin) · public/ (css, js, img, fonts) · data/ (SQLite)

Add a page: create `views/pages/name.html`, register it in `PAGES` in `server/render.js`.
