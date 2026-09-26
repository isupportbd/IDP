import { relations } from "drizzle-orm";
import { doublePrecision, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";

export const subscriptionTransactions = pgTable("subscription_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
  planId: integer("plan_id").references(() => plans.id, { onUpdate: "cascade", onDelete: "set null" }),
  type: varchar("type", { length: 30 }).notNull().default("deposit"), // deposit | plan_fee | renewal_fee | manual_extension
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull().default("monthly"),
  grossAmount: integer("gross_amount").notNull().default(0),
  gatewayCharge: doublePrecision("gateway_charge").notNull().default(0),
  netAmount: integer("net_amount").notNull().default(0),
  planRate: integer("plan_rate").notNull().default(0),
  paidAmount: integer("paid_amount").notNull().default(0),
  excessCredit: integer("excess_credit").notNull().default(0),
  trxId: varchar("trx_id", { length: 100 }),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull().default("bkash"),
  daysAdded: integer("days_added").default(0),
  status: varchar("status", { length: 20 }).notNull().default("completed"), // pending | completed | rejected
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const subscriptionTransactionsRelations = relations(subscriptionTransactions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptionTransactions.userId],
    references: [users.id]
  }),
  plan: one(plans, {
    fields: [subscriptionTransactions.planId],
    references: [plans.id]
  })
}));
