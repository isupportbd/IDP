import { boolean, integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";

export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id, { onDelete: "cascade" }),
  bankName: varchar("bank_name", { length: 150 }).notNull(),
  accountName: varchar("account_name", { length: 150 }).notNull(),
  accountNumber: varchar("account_number", { length: 100 }).notNull(),
  branchName: varchar("branch_name", { length: 150 }),
  routingNumber: varchar("routing_number", { length: 50 }),
  bkashNumber: varchar("bkash_number", { length: 50 }),
  nagadNumber: varchar("nagad_number", { length: 50 }),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

