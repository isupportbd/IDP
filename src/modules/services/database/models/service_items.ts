import { relations } from "drizzle-orm";
import { boolean, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { serviceRates } from "./service_rates.js";

export const serviceItems = pgTable("service_items", {
  id: serial("id").primaryKey(),
  itemName: varchar("item_name", { length: 255 }).notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const serviceItemsRelations = relations(serviceItems, ({ many }) => ({
  serviceRates: many(serviceRates)
}));
