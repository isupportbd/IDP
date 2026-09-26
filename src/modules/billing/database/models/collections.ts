import { relations } from "drizzle-orm";
import { doublePrecision, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { clients } from "@/modules/clients/database/models/clients.js";
import { bills } from "./bills.js";
import { users } from "@/modules/auth/database/models/user.js";

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  receiptNo: varchar("receipt_no", { length: 50 }).notNull().unique(), // e.g. MR-2026-000001
  billId: integer("bill_id").references(() => bills.id, { onDelete: "set null" }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  collectionDate: timestamp("collection_date", { withTimezone: true }).notNull(),
  amount: doublePrecision("amount").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash").notNull(), // 'cash' | 'bank' | 'cheque' | 'bkash' | 'nagad' | 'rocket' | 'other'
  referenceNo: varchar("reference_no", { length: 100 }), // Cheque number, TrxID, Bank deposit slip
  notes: text("notes"),
  receivedBy: integer("received_by").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 30 }).default("completed").notNull(), // 'completed' | 'cancelled'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const collectionsRelations = relations(collections, ({ one }) => ({
  client: one(clients, {
    fields: [collections.clientId],
    references: [clients.id]
  }),
  bill: one(bills, {
    fields: [collections.billId],
    references: [bills.id]
  }),
  receiver: one(users, {
    fields: [collections.receivedBy],
    references: [users.id]
  })
}));
