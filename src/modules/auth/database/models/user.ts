import { relations } from "drizzle-orm";
import { boolean, doublePrecision, integer, json, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { roles } from "@/modules/auth/database/models/role.js";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  mobile: varchar("mobile", { length: 20 }),
  password: text("password").notNull(),
  roleId: integer("role_id").references(() => roles.id, { onUpdate: "cascade", onDelete: "set null" }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  planId: integer("plan_id"),
  billingCycle: varchar("billing_cycle", { length: 20 }),
  trxId: varchar("trx_id", { length: 100 }),
  paidAmount: integer("paid_amount").default(0),
  advanceBalance: integer("advance_balance").default(0),
  smsBalance: doublePrecision("sms_balance").default(0),
  adminId: integer("admin_id"),
  permissions: json("permissions").$type<string[]>().default([]),
  expDate: timestamp("exp_date"),
  extraStorageMB: integer("extra_storage_mb").notNull().default(0),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onUpdate: "cascade", onDelete: "set null" }),
  jti: varchar("jti", { length: 191 }).notNull().unique(),
  revoked: boolean("revoked").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id]
  }),
  refreshTokens: many(refreshTokens)
}));

