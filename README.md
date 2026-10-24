# Vierra Care Services — Website

Static multi-page site with custom animations (no framework, fast on mobile data), pre-rendered at build time and hosted on Netlify. Form submissions and the admin inbox run on Netlify Functions, with data stored in Netlify Database (Postgres).

## Run it
```bash
npm install
npm run build            # renders pages into dist/
npm run dev              # netlify dev → http://localhost:8888
```

## Before going live (important)
1. **Edit `config/site.js`**: phone, WhatsApp number, email, address, hours, social links. Every page updates.
2. **Set environment variables in Netlify**: `ADMIN_PASSWORD`, `SESSION_SECRET`, `SITE_URL` (see `.env.example`). Admin sign-in stays disabled until `ADMIN_PASSWORD` is set.
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
Netlify builds with `npm run build` and publishes `dist/` (see `netlify.toml`). Database migrations in `netlify/database/migrations/` are applied automatically on deploy. After changing `db/schema.ts`, run `npx drizzle-kit generate --name <change>`.

## Structure
config/site.js (business details) · scripts/build.js (static page renderer) · netlify/functions/ (form + admin API) · db/ (schema + queries) · server/ (auth, mailer, templating) · views/ (layout, partials, pages, admin) · public/ (css, js, img, fonts)

Add a page: create `views/pages/name.html`, register it in `PAGES` in `server/render.js`.
