import { relations } from "drizzle-orm";
import { index, integer, pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";
import { clients } from "./clients.js";

export const clientManagers = pgTable(
  "client_managers",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .references(() => clients.id, { onUpdate: "cascade", onDelete: "cascade" })
      .notNull(),
    managerId: integer("manager_id")
      .references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" })
      .notNull(),
    assignedBy: integer("assigned_by").references(() => users.id, { onUpdate: "cascade", onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    clientManagerIdx: index("client_managers_client_mgr_idx").on(table.clientId, table.managerId),
    managerIdIdx: index("client_managers_manager_id_idx").on(table.managerId)
  })
);

export const clientManagersRelations = relations(clientManagers, ({ one }) => ({
  client: one(clients, {
    fields: [clientManagers.clientId],
    references: [clients.id]
  }),
  manager: one(users, {
    fields: [clientManagers.managerId],
    references: [users.id]
  }),
  assignedByUser: one(users, {
    fields: [clientManagers.assignedBy],
    references: [users.id]
  })
}));
