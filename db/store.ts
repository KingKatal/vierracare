// Data access for the inquiries inbox.
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "./index.js";
import { inquiries } from "./schema.js";

export type InquiryType = "contact" | "care_request" | "application";
export type InquiryStatus = "new" | "in_progress" | "done";

export async function add(row: {
  type: InquiryType; name: string; email: string; phone: string;
  payload: Record<string, unknown>; ip?: string;
}) {
  const [r] = await db.insert(inquiries).values({
    type: row.type, name: row.name, email: row.email || null, phone: row.phone || null,
    payload: row.payload || {}, ip: row.ip || null,
  }).returning({ id: inquiries.id });
  return r.id;
}

export async function list({ type, status, q, limit = 500 }: { type?: string; status?: string; q?: string; limit?: number } = {}) {
  const where: SQL[] = [];
  if (type) where.push(eq(inquiries.type, type));
  if (status) where.push(eq(inquiries.status, status));
  if (q) {
    const s = `%${q}%`;
    where.push(or(ilike(inquiries.name, s), ilike(inquiries.email, s), ilike(inquiries.phone, s), sql`${inquiries.payload}::text ILIKE ${s}`)!);
  }
  const rows = await db.select().from(inquiries)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(inquiries.createdAt))
    .limit(Math.max(1, Math.min(Number(limit) || 500, 100_000)));
  return rows.map(({ createdAt, ...r }) => ({ ...r, created_at: createdAt.toISOString(), payload: r.payload || {} }));
}

export async function stats() {
  const out = { total: 0, new: 0, care_request: 0, contact: 0, application: 0 };
  const rows = await db.select({ type: inquiries.type, status: inquiries.status, c: sql<number>`count(*)::int` })
    .from(inquiries).groupBy(inquiries.type, inquiries.status);
  for (const row of rows) {
    out.total += row.c;
    out[row.type as InquiryType] += row.c;
    if (row.status === "new") out.new += row.c;
  }
  return out;
}

export async function update(id: number, { status, notes }: { status?: InquiryStatus; notes?: unknown } = {}) {
  const set: { status?: InquiryStatus; notes?: string } = {};
  if (status) set.status = status;
  if (typeof notes === "string") set.notes = notes.slice(0, 4000);
  if (Object.keys(set).length) await db.update(inquiries).set(set).where(eq(inquiries.id, id));
}

export async function remove(id: number) {
  await db.delete(inquiries).where(eq(inquiries.id, id));
}
