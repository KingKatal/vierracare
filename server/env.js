// Minimal .env loader (no extra dependency).
// On Vercel, environment variables come from the dashboard, so the file is skipped.
try {
  const fs = require('fs');
  const path = require('path');
  const p = path.join(__dirname, '..', '.env');
  if (!process.env.VERCEL && fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  }
} catch {}
