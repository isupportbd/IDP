import { boolean, doublePrecision, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const vatNotes = pgTable("vat_notes_mapping", {
  id: serial("id").primaryKey(),
  vatRate: doublePrecision("vat_rate").notNull().unique(),
  noteName: varchar("note_name", { length: 50 }).notNull(),
  description: varchar("description", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

