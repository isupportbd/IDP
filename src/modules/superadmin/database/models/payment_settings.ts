import { doublePrecision, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const paymentSettings = pgTable("payment_settings", {
  id: serial("id").primaryKey(),
  bkashNumber: varchar("bkash_number", { length: 50 }).notNull().default("01719950891"),
  bkashCharge: doublePrecision("bkash_charge").notNull().default(1.8),
  nagadNumber: varchar("nagad_number", { length: 50 }),
  rocketNumber: varchar("rocket_number", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
