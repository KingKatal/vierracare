// Admin inbox API: session status, list/update/delete inquiries, CSV export.
import type { Config, Context } from "@netlify/functions";
import * as store from "../../db/store.js";
import * as auth from "../../server/auth.js";
import { clean, readJson } from "../../server/validate.js";

const TYPES = ['contact', 'care_request', 'application'];
const STATUSES = ['new', 'in_progress', 'done'];

export default async (req: Request, context: Context) => {
  const { pathname, searchParams } = new URL(req.url);
  const route = `${req.method} ${pathname.replace(/^\/api\/admin/, '')}`;

  if (route === 'POST /logout') return Response.json({ ok: true }, { headers: { 'Set-Cookie': auth.clear() } });
  if (route === 'GET /me') return Response.json({ signedIn: auth.valid(req) });

  if (!auth.valid(req)) return Response.json({ error: 'Not signed in' }, { status: 401 });

  try {
    if (route === 'GET /inquiries') {
      const type = searchParams.get('type') || '';
      const status = searchParams.get('status') || '';
      const [stats, items] = await Promise.all([
        store.stats(),
        store.list({
          type: TYPES.includes(type) ? type : '',
          status: STATUSES.includes(status) ? status : '',
          q: clean(searchParams.get('q'), 80)
        })
      ]);
      return Response.json({ stats, items });
    }

    if (route === 'GET /export.csv') {
      const q = (v: unknown) => { let x = String(v ?? ''); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return `"${x.replace(/"/g, '""')}"`; }; // blocks spreadsheet formula injection
      const rows = await store.list({ limit: 100000 });
      const csv = ['id,received,type,status,name,email,phone,details,notes',
        ...rows.map(r => [r.id, r.created_at, r.type, r.status, r.name, r.email, r.phone,
          Object.entries(r.payload).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : v}`).join(' | '), r.notes].map(q).join(','))].join('\n');
      return new Response('﻿' + csv, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="vierra-inquiries.csv"' }
      });
    }

    const id = Number(context.params.id);
    if (context.params.id && Number.isInteger(id)) {
      if (req.method === 'PATCH') {
        const { status, notes } = await readJson(req);
        await store.update(id, { status: STATUSES.includes(status) ? status : undefined, notes });
        return Response.json({ ok: true });
      }
      if (req.method === 'DELETE') {
        await store.remove(id);
        return Response.json({ ok: true });
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  } catch (e) {
    console.error('[admin]', route, e);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/admin/logout", "/api/admin/me", "/api/admin/inquiries", "/api/admin/inquiries/:id", "/api/admin/export.csv"],
};
