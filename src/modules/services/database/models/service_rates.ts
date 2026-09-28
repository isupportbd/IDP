import { relations } from "drizzle-orm";
import { doublePrecision, index, integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { serviceItems } from "./service_items.js";
import { customerTypes } from "./customer_types.js";

export const serviceRates = pgTable(
  "service_rates",
  {
    id: serial("id").primaryKey(),
    serviceItemId: integer("service_item_id").notNull().references(() => serviceItems.id, { onDelete: "cascade" }),
    customerTypeId: integer("customer_type_id").references(() => customerTypes.id, { onDelete: "set null" }),
    unit: varchar("unit", { length: 50 }).default("Month").notNull(),
    regularRate: doublePrecision("regular_rate").default(0).notNull(),
    minimumCharge: doublePrecision("minimum_charge").default(0).notNull(),
    effectiveFrom: varchar("effective_from", { length: 10 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => ({
    serviceItemCustomerTypeIdx: index("service_rates_item_type_idx").on(table.serviceItemId, table.customerTypeId)
  })
);

export const serviceRatesRelations = relations(serviceRates, ({ one }) => ({
  serviceItem: one(serviceItems, {
    fields: [serviceRates.serviceItemId],
    references: [serviceItems.id]
  }),
  customerType: one(customerTypes, {
    fields: [serviceRates.customerTypeId],
    references: [customerTypes.id]
  })
}));
