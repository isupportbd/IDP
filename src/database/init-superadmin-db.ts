import { initDatabase } from "../framework/database/connection.js";
import { syncDatabaseSchemaAndSuperAdmin } from "./sync.js";

async function main() {
  await initDatabase();
  console.log("Setting up PostgreSQL database schema and SuperAdmin account...");
  await syncDatabaseSchemaAndSuperAdmin();
  console.log("Database schema and SuperAdmin initialization complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
