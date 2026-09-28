import { boolean, index, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const globalItems = pgTable(
  "global_items",
  {
    id: serial("id").primaryKey(),
    hsCode: varchar("hs_code", { length: 50 }).notNull(),
    awHsCode: varchar("aw_hs_code", { length: 50 }),
    name: varchar("name", { length: 255 }).notNull(),
    unit: varchar("unit", { length: 50 }).default("U").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    hsCodeIdx: index("global_items_hs_code_idx").on(table.hsCode),
    awHsCodeIdx: index("global_items_aw_hs_code_idx").on(table.awHsCode),
    isActiveIdx: index("global_items_is_active_idx").on(table.isActive),
    nameIdx: index("global_items_name_idx").on(table.name)
  })
);


