import { sql } from "drizzle-orm";
import { bigserial, check, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Every form submission (contact message, care request, job application).
export const inquiries = pgTable(
  "inquiries",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    type: text().notNull(),
    name: text().notNull(),
    email: text(),
    phone: text(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    status: text().notNull().default("new"),
    notes: text().notNull().default(""),
    ip: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("inquiries_type_check", sql`${t.type} IN ('contact','care_request','application')`),
    check("inquiries_status_check", sql`${t.status} IN ('new','in_progress','done')`),
    index("idx_inq_type").on(t.type),
    index("idx_inq_status").on(t.status),
    index("idx_inq_created").on(t.createdAt.desc()),
  ],
);
