import { pgTable, serial, integer, varchar, text, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";

export interface SmsTemplateVariable {
  name: string;
  label: string;
  sample: string;
  description?: string;
}

export const smsTemplates = pgTable("sms_templates", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  body: text("body").notNull(),
  variables: jsonb("variables").$type<SmsTemplateVariable[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  adminKeyIdx: index("sms_templates_admin_key_idx").on(table.adminId, table.key),
  keyIdx: index("sms_templates_key_idx").on(table.key)
}));
