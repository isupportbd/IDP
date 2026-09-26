import { boolean, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const columnMappings = pgTable("column_mappings", {
  id: serial("id").primaryKey(),
  dbColumn: varchar("db_column", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  excelHeader: varchar("excel_header", { length: 255 }),
  isCalculated: boolean("is_calculated").default(false).notNull(),
  isFromDb: boolean("is_from_db").default(false).notNull(),
  isRegexExtracted: boolean("is_regex_extracted").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
