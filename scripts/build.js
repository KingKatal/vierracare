// Pre-renders every page into dist/ alongside the static assets in public/.
// Netlify serves dist/ from its CDN; /api/* is handled by Netlify Functions.
import fs from 'node:fs';
import path from 'node:path';
import site from '../config/site.js';
import { PAGES, page, notFound } from '../server/render.js';

const ROOT = path.join(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist');

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });

const write = (file, body) => fs.writeFileSync(path.join(OUT, file), body);

for (const route of Object.keys(PAGES)) {
  write(route === '/' ? 'index.html' : `${route.slice(1)}.html`, page(route));
}
write('404.html', notFound());
fs.copyFileSync(path.join(ROOT, 'views', 'admin.html'), path.join(OUT, 'admin.html'));

write('robots.txt', `User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${site.url}/sitemap.xml\n`);
const urls = Object.keys(PAGES).map(r => `<url><loc>${site.url}${r === '/' ? '' : r}</loc></url>`).join('');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);

console.log(`Built ${Object.keys(PAGES).length + 1} pages into dist/ (site URL: ${site.url})`);
