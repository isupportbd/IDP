import { date, doublePrecision, index, integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";
import { clients } from "./clients.js";
import { globalItems } from "@/modules/superadmin/database/models/global_items.js";
import { unitConversions } from "@/modules/superadmin/database/models/unit_conversions.js";

export const salesRates = pgTable(
  "sales_rates",
  {
    id: serial("id").primaryKey(),
    adminId: integer("admin_id")
      .references(() => users.id)
      .notNull()
      .default(1),
    clientId: integer("client_id")
      .references(() => clients.id)
      .notNull(),
    itemId: integer("item_id")
      .references(() => globalItems.id)
      .notNull(),
    unitId: integer("unit_id")
      .references(() => unitConversions.id),
    salesRate: doublePrecision("sales_rate").notNull(),
    vatRate: doublePrecision("vat_rate").notNull(),
    vatableValue: doublePrecision("vatable_value").notNull(),
    additionPercent: doublePrecision("addition_percent").default(0),
    activationDate: date("activation_date").notNull(),
    status: varchar("status", { length: 20 }).default("Active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    adminIdIdx: index("sales_rates_admin_id_idx").on(table.adminId),
    clientIdIdx: index("sales_rates_client_id_idx").on(table.clientId),
    itemIdIdx: index("sales_rates_item_id_idx").on(table.itemId),
    clientStatusIdx: index("sales_rates_client_status_idx").on(table.clientId, table.status),
    ratesLookupIdx: index("sales_rates_lookup_idx").on(table.clientId, table.itemId, table.status, table.activationDate)
  })
);
