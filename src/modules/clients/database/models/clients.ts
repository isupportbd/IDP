import { relations } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { customerTypes } from "@/modules/services/database/models/customer_types.js";
import { clientReferences } from "@/modules/services/database/models/references.js";
import { users } from "@/modules/auth/database/models/user.js";
import { clientManagers } from "./client_managers.js";

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    proprietorName: varchar("proprietor_name", { length: 255 }),
    mobile: varchar("mobile", { length: 50 }),
    alternativeMobile: varchar("alternative_mobile", { length: 50 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    binNumber: varchar("bin_number", { length: 50 }),
    tinNumber: varchar("tin_number", { length: 50 }),
    tradeLicenseNo: varchar("trade_license_no", { length: 100 }),
    customerTypeId: integer("customer_type_id").references(() => customerTypes.id, { onUpdate: "cascade", onDelete: "set null" }),
    referenceId: integer("reference_id").references(() => clientReferences.id, { onUpdate: "cascade", onDelete: "set null" }),
    vatUserId: varchar("vat_user_id", { length: 100 }),
    vatPassword: varchar("vat_password", { length: 255 }),
    vatServiceType: varchar("vat_service_type", { length: 50 }).default("FULL").notNull(),
    openingBalance: doublePrecision("opening_balance").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onUpdate: "cascade", onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    createdByActiveIdx: index("clients_created_by_active_idx").on(table.createdBy, table.isActive),
    binNumberIdx: index("clients_bin_number_idx").on(table.binNumber),
    customerTypeIdIdx: index("clients_customer_type_id_idx").on(table.customerTypeId),
    referenceIdIdx: index("clients_reference_id_idx").on(table.referenceId),
    companyNameIdx: index("clients_company_name_idx").on(table.companyName)
  })
);

export const clientsRelations = relations(clients, ({ one, many }) => ({
  customerType: one(customerTypes, {
    fields: [clients.customerTypeId],
    references: [customerTypes.id]
  }),
  reference: one(clientReferences, {
    fields: [clients.referenceId],
    references: [clientReferences.id]
  }),
  creator: one(users, {
    fields: [clients.createdBy],
    references: [users.id]
  }),
  managers: many(clientManagers)
}));
