import { boolean, date, doublePrecision, index, integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";
import { clients } from "./clients.js";
import { globalItems } from "@/modules/superadmin/database/models/global_items.js";

export const purchases = pgTable(
  "purchases",
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
    office: varchar("office", { length: 100 }),
    beNo: varchar("be_no", { length: 100 }),
    beDate: date("be_date").notNull(),
    month: varchar("month", { length: 7 }).notNull(),
    lcNumber: varchar("lc_number", { length: 100 }),
    netWt: doublePrecision("net_wt").notNull(),
    excessQty: doublePrecision("excess_qty"),
    totalQty: doublePrecision("total_qty"),
    assValue: doublePrecision("ass_value").notNull(),
    unitValue: doublePrecision("unit_value"),
    cd: doublePrecision("cd"),
    rd: doublePrecision("rd"),
    sd: doublePrecision("sd"),
    baseValueOfVat: doublePrecision("base_value_of_vat"),
    vat: doublePrecision("vat"),
    at: doublePrecision("at"),
    isRebate: boolean("is_rebate").default(false),
    isFfs: boolean("is_ffs").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    adminIdIdx: index("purchases_admin_id_idx").on(table.adminId),
    clientIdIdx: index("purchases_client_id_idx").on(table.clientId),
    itemIdIdx: index("purchases_item_id_idx").on(table.itemId),
    monthIdx: index("purchases_month_idx").on(table.month),
    adminMonthIdx: index("purchases_admin_month_idx").on(table.adminId, table.month),
    clientMonthIdx: index("purchases_client_month_idx").on(table.clientId, table.month)
  })
);
