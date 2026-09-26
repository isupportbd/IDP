import { boolean, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const globalItems = pgTable("global_items", {
  id: serial("id").primaryKey(),
  hsCode: varchar("hs_code", { length: 50 }).notNull(),
  awHsCode: varchar("aw_hs_code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 50 }).default("U").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});


