import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";

export const smsLogs = pgTable("sms_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id, { onDelete: "set null" }),
  recipientMobile: varchar("recipient_mobile", { length: 32 }).notNull(),
  message: text("message").notNull(),
  templateKey: varchar("template_key", { length: 64 }),
  submissionId: varchar("submission_id", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("SENT"),
  providerResponse: text("provider_response"),
  sentBy: integer("sent_by").references(() => users.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow()
});
