import { relations } from "drizzle-orm";
import { doublePrecision, index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { clients } from "@/modules/clients/database/models/clients.js";
import { clientReferences } from "@/modules/services/database/models/references.js";
import { users } from "@/modules/auth/database/models/user.js";
import { billItems } from "./bill_items.js";
import { collections } from "./collections.js";

export const bills = pgTable(
  "bills",
  {
    id: serial("id").primaryKey(),
    billNo: varchar("bill_no", { length: 50 }).notNull().unique(), // e.g. Inv-2026-000001
    clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    referenceId: integer("reference_id").references(() => clientReferences.id, { onDelete: "set null" }),
    taxPeriod: varchar("tax_period", { length: 10 }).notNull(), // e.g. "2026-08"
    billDate: timestamp("bill_date", { withTimezone: true }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    subtotal: doublePrecision("subtotal").default(0).notNull(),
    discountAmount: doublePrecision("discount_amount").default(0).notNull(),
    previousDue: doublePrecision("previous_due").default(0).notNull(),
    grandTotal: doublePrecision("grand_total").default(0).notNull(),
    paidAmount: doublePrecision("paid_amount").default(0).notNull(),
    dueAmount: doublePrecision("due_amount").default(0).notNull(),
    status: varchar("status", { length: 30 }).default("unpaid").notNull(), // 'paid' | 'partial' | 'unpaid' | 'overdue' | 'cancelled' | 'draft'
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    clientTaxPeriodIdx: index("bills_client_tax_period_idx").on(table.clientId, table.taxPeriod),
    taxPeriodStatusIdx: index("bills_tax_period_status_idx").on(table.taxPeriod, table.status),
    billNoIdx: index("bills_bill_no_idx").on(table.billNo),
    createdByIdx: index("bills_created_by_idx").on(table.createdBy)
  })
);

export const billsRelations = relations(bills, ({ one, many }) => ({
  client: one(clients, {
    fields: [bills.clientId],
    references: [clients.id]
  }),
  reference: one(clientReferences, {
    fields: [bills.referenceId],
    references: [clientReferences.id]
  }),
  creator: one(users, {
    fields: [bills.createdBy],
    references: [users.id]
  }),
  items: many(billItems),
  collections: many(collections)
}));
