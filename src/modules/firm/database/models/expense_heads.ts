import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";

export const expenseHeads = pgTable("expense_heads", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  code: varchar("code", { length: 50 }),
  category: varchar("category", { length: 100 }).notNull().default("Operational"),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

