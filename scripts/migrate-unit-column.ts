// @ts-nocheck
import { initDatabase } from "../src/framework/database/connection.js";
import { db } from "../src/framework/facade.js";
import { sql } from "drizzle-orm";

async function main() {
  await initDatabase();
  console.log("Adding unit column to service_rates table in PostgreSQL if not exists...");
  await db.execute(sql`ALTER TABLE service_rates ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'Month' NOT NULL;`);
  
  // Also update existing default records with sensible units if needed
  await db.execute(sql`
    UPDATE service_rates 
    SET unit = 'MT' 
    WHERE regular_rate < 100 AND unit = 'Month';
  `);

  console.log("Migration executed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
