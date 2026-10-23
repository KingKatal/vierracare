// Data layer.
//
// - Local development: SQLite through Node's built-in driver (no native compile).
// - Production on Vercel: Postgres through DATABASE_URL (Neon, Vercel Postgres,
//   Supabase, etc.). Vercel's filesystem is ephemeral, so SQLite must not be
//   used for real data there.
//
// Set DATABASE_URL to switch to Postgres. Without it, a SQLite file is used,
// which is persisted locally but (on Vercel) lives in /tmp and is lost between
// cold starts.
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;
const ON_VERCEL = Boolean(process.env.VERCEL);
const USE_POSTGRES = Boolean(DATABASE_URL);

const TABLE_SQLITE = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS inquiries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL CHECK (type IN ('contact','care_request','application')),
    name       TEXT NOT NULL,
    email      TEXT,
    phone      TEXT,
    payload    TEXT NOT NULL DEFAULT '{}',
    status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done')),
    notes      TEXT NOT NULL DEFAULT '',
    ip         TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_inq_type ON inquiries(type);
  CREATE INDEX IF NOT EXISTS idx_inq_status ON inquiries(status);
  CREATE INDEX IF NOT EXISTS idx_inq_created ON inquiries(created_at DESC);
`;

const TABLE_POSTGRES = `
  CREATE TABLE IF NOT EXISTS inquiries (
    id         BIGSERIAL PRIMARY KEY,
    type       TEXT NOT NULL CHECK (type IN ('contact','care_request','application')),
    name       TEXT NOT NULL,
    email      TEXT,
    phone      TEXT,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done')),
    notes      TEXT NOT NULL DEFAULT '',
    ip         TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_inq_type ON inquiries(type);
  CREATE INDEX IF NOT EXISTS idx_inq_status ON inquiries(status);
  CREATE INDEX IF NOT EXISTS idx_inq_created ON inquiries(created_at DESC);
`;

/* ── Postgres backend ─────────────────────────────────────── */
let pool;
let pgReady;

function postgres() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.DATABASE_SSL === 'false' ? false : undefined
    });
    pool.on('error', (err) => console.error('[db] idle client error:', err.message));
  }
  if (!pgReady) {
    pgReady = pool.query(TABLE_POSTGRES).catch((err) => {
      pgReady = undefined;
      throw err;
    });
  }
  return { pool, ready: pgReady };
}

/* ── SQLite backend (local dev) ───────────────────────────── */
let sqlite;
let sqliteReady;

function sqliteDb() {
  if (!sqlite) {
    // Vercel only allows writes to /tmp; local installs keep data/ persistent.
    const dir = process.env.DATA_DIR
      || (ON_VERCEL ? path.join('/tmp', 'vierra-data') : path.join(__dirname, '..', 'data'));
    fs.mkdirSync(dir, { recursive: true });
    const { DatabaseSync } = require('node:sqlite');
    sqlite = new DatabaseSync(path.join(dir, 'vierra.db'));
    sqliteReady = sqlite.exec(TABLE_SQLITE);
  }
  return { db: sqlite, ready: sqliteReady };
}

async function backend() {
  if (USE_POSTGRES) {
    const { pool: p, ready } = postgres();
    await ready;
    return { kind: 'postgres', pool: p };
  }
  const { db, ready } = sqliteDb();
  await ready;
  if (ON_VERCEL && !process.env.DATABASE_URL) {
    console.warn('[db] DATABASE_URL is not set — using ephemeral /tmp SQLite. Inquiries will be lost on redeploy or cold start.');
  }
  return { kind: 'sqlite', db };
}

/* ── Shared API ───────────────────────────────────────────── */

async function add({ type, name, email, phone, payload, ip }) {
  const be = await backend();
  const json = JSON.stringify(payload || {});
  if (be.kind === 'postgres') {
    const r = await be.pool.query(
      'INSERT INTO inquiries (type,name,email,phone,payload,ip) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [type, name, email || null, phone || null, json, ip || null]
    );
    return Number(r.rows[0].id);
  }
  const r = be.db.prepare(
    'INSERT INTO inquiries (type,name,email,phone,payload,ip) VALUES (?,?,?,?,?,?)'
  ).run(type, name, email || null, phone || null, json, ip || null);
  return Number(r.lastInsertRowid);
}

async function list({ type, status, q, limit = 500 } = {}) {
  const be = await backend();
  const limitNum = Math.max(1, Math.min(Number(limit) || 500, 100_000));

  if (be.kind === 'postgres') {
    const where = [];
    const args = [];
    if (type) { args.push(type); where.push(`type = $${args.length}`); }
    if (status) { args.push(status); where.push(`status = $${args.length}`); }
    if (q) {
      args.push(`%${q}%`);
      const n = args.length;
      where.push(`(name ILIKE $${n} OR email ILIKE $${n} OR phone ILIKE $${n} OR payload::text ILIKE $${n})`);
    }
    args.push(limitNum);
    const sql = `SELECT * FROM inquiries ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY created_at DESC LIMIT $${args.length}`;
    const r = await be.pool.query(sql, args);
    return r.rows.map(row => ({ ...row, id: Number(row.id), payload: row.payload || {} }));
  }

  const where = [];
  const args = [];
  if (type) { where.push('type = ?'); args.push(type); }
  if (status) { where.push('status = ?'); args.push(status); }
  if (q) {
    where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR payload LIKE ?)');
    const s = `%${q}%`; args.push(s, s, s, s);
  }
  const sql = `SELECT * FROM inquiries ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY created_at DESC LIMIT ?`;
  return be.db.prepare(sql).all(...args, limitNum).map(row => ({ ...row, payload: JSON.parse(row.payload) }));
}

async function stats() {
  const be = await backend();
  const out = { total: 0, new: 0, care_request: 0, contact: 0, application: 0 };

  if (be.kind === 'postgres') {
    const r = await be.pool.query('SELECT type, status, COUNT(*)::int AS c FROM inquiries GROUP BY type, status');
    for (const row of r.rows) {
      out.total += row.c;
      out[row.type] += row.c;
      if (row.status === 'new') out.new += row.c;
    }
    return out;
  }

  const rows = be.db.prepare('SELECT type, status, COUNT(*) c FROM inquiries GROUP BY type, status').all();
  for (const row of rows) {
    out.total += row.c;
    out[row.type] += row.c;
    if (row.status === 'new') out.new += row.c;
  }
  return out;
}

async function update(id, { status, notes } = {}) {
  const be = await backend();
  const numId = Number(id);
  if (be.kind === 'postgres') {
    if (status) await be.pool.query('UPDATE inquiries SET status = $1 WHERE id = $2', [status, numId]);
    if (typeof notes === 'string') {
      await be.pool.query('UPDATE inquiries SET notes = $1 WHERE id = $2', [notes.slice(0, 4000), numId]);
    }
    return;
  }
  if (status) be.db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(status, numId);
  if (typeof notes === 'string') {
    be.db.prepare('UPDATE inquiries SET notes = ? WHERE id = ?').run(notes.slice(0, 4000), numId);
  }
}

async function remove(id) {
  const be = await backend();
  const numId = Number(id);
  if (be.kind === 'postgres') {
    await be.pool.query('DELETE FROM inquiries WHERE id = $1', [numId]);
    return;
  }
  be.db.prepare('DELETE FROM inquiries WHERE id = ?').run(numId);
}

module.exports = {
  add,
  list,
  stats,
  update,
  remove,
  get mode() { return USE_POSTGRES ? 'postgres' : 'sqlite'; }
};
