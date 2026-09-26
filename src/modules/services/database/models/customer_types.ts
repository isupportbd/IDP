import { relations } from "drizzle-orm";
import { boolean, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { serviceRates } from "./service_rates.js";

export const customerTypes = pgTable("customer_types", {
  id: serial("id").primaryKey(),
  typeName: varchar("type_name", { length: 255 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const customerTypesRelations = relations(customerTypes, ({ many }) => ({
  serviceRates: many(serviceRates)
}));
