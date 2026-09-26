import { boolean, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const expenseHeads = pgTable("expense_heads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull().unique(),
  code: varchar("code", { length: 50 }).unique(),
  category: varchar("category", { length: 100 }).notNull().default("Operational"),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
