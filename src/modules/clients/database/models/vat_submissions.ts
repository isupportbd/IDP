import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { clients } from "./clients.js";
import { users } from "@/modules/auth/database/models/user.js";

export const vatSubmissions = pgTable(
  "vat_submissions",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .references(() => clients.id, { onUpdate: "cascade", onDelete: "cascade" })
      .notNull(),
    taxPeriod: varchar("tax_period", { length: 20 }).notNull(), // e.g. "2026-08"
    submissionId: varchar("submission_id", { length: 100 }).notNull(), // NBR ack number
    status: varchar("status", { length: 50 }).default("submitted").notNull(), // "submitted" | "late_submitted"
    submittedBy: integer("submitted_by").references(() => users.id, { onUpdate: "cascade", onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("vat_submissions_client_tax_period_idx").on(table.clientId, table.taxPeriod)
  ]
);

export const vatSubmissionsRelations = relations(vatSubmissions, ({ one }) => ({
  client: one(clients, {
    fields: [vatSubmissions.clientId],
    references: [clients.id]
  }),
  submitter: one(users, {
    fields: [vatSubmissions.submittedBy],
    references: [users.id]
  })
}));
