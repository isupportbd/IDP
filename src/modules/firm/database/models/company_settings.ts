import { boolean, integer, pgTable, serial, text, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";

export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id, { onDelete: "cascade" }),
  companyName: varchar("company_name", { length: 255 }).notNull().default(""),
  proprietorName: varchar("proprietor_name", { length: 255 }).default(""),
  phone: varchar("phone", { length: 50 }).default(""),
  email: varchar("email", { length: 255 }).default(""),
  website: varchar("website", { length: 255 }).default(""),
  address: text("address").default(""),
  binNumber: varchar("bin_number", { length: 50 }).default(""),
  tinNumber: varchar("tin_number", { length: 50 }).default(""),
  tradeLicenseNo: varchar("trade_license_no", { length: 100 }).default(""),
  invoicePrefix: varchar("invoice_prefix", { length: 20 }).default("INV"),
  invoiceTerms: text("invoice_terms").default("1. Payment is due within 15 days of invoice date.\n2. Please mention the invoice number as reference in payment.\n3. Checks/Transfers are subject to realization."),
  receiptPrefix: varchar("receipt_prefix", { length: 20 }).default("RCP"),
  autoDueCarryForward: boolean("auto_due_carry_forward").default(true).notNull(),
  binUniqueEnforcement: boolean("bin_unique_enforcement").default(true).notNull(),
  allowDuplicateMobile: boolean("allow_duplicate_mobile").default(true).notNull(),
  smsApiKey: text("sms_api_key"),
  smsSenderId: varchar("sms_sender_id", { length: 50 }).default(""),
  smsProvider: varchar("sms_provider", { length: 100 }).default(""),
  smsEndpointUrl: text("sms_endpoint_url").default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  adminIdIdx: index("company_settings_admin_id_idx").on(table.adminId)
}));

