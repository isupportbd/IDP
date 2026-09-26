import { doublePrecision, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const unitConversions = pgTable("unit_conversions", {
  id: serial("id").primaryKey(),
  purchaseUnit: varchar("purchase_unit", { length: 50 }).notNull(),
  salesUnit: varchar("sales_unit", { length: 50 }).notNull(),
  factor: doublePrecision("factor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
