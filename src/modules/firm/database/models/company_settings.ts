import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";

export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id, { onDelete: "cascade" }),
  companyName: varchar("company_name", { length: 255 }).notNull().default("ASSOCIATES & CO. VAT & TAX CONSULTANCY"),
  proprietorName: varchar("proprietor_name", { length: 255 }).default("Advocate Md. Ruhul Amin"),
  phone: varchar("phone", { length: 50 }).default("+880 1819-234567"),
  email: varchar("email", { length: 255 }).default("billing@associatesvat.com"),
  website: varchar("website", { length: 255 }).default("https://associatesvat.com"),
  address: text("address").default("Suite # 504, City Heart Building, 67 Naya Paltan, VIP Road, Dhaka-1000"),
  binNumber: varchar("bin_number", { length: 50 }).default("001234567-0101"),
  tinNumber: varchar("tin_number", { length: 50 }).default("782910384721"),
  tradeLicenseNo: varchar("trade_license_no", { length: 100 }).default("TRAD/DSCC/038291"),
  invoicePrefix: varchar("invoice_prefix", { length: 20 }).default("INV"),
  invoiceTerms: text("invoice_terms").default("1. Payment is due within 15 days of invoice date.\n2. Please mention the invoice number as reference in payment.\n3. Checks/Transfers are subject to realization."),
  receiptPrefix: varchar("receipt_prefix", { length: 20 }).default("MR"),
  autoDueCarryForward: boolean("auto_due_carry_forward").default(true).notNull(),
  binUniqueEnforcement: boolean("bin_unique_enforcement").default(true).notNull(),
  allowDuplicateMobile: boolean("allow_duplicate_mobile").default(true).notNull(),
  smsApiKey: text("sms_api_key"),
  smsSenderId: varchar("sms_sender_id", { length: 50 }).default("VAT-IDP"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

