// @ts-nocheck
import { initDatabase } from "../src/framework/database/connection.js";
import { db } from "../src/framework/facade.js";
import { sql } from "drizzle-orm";
import { serviceUnits } from "../src/modules/services/database/models/service_units.js";

async function main() {
  await initDatabase();
  console.log("Creating service_units table if not exists...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS service_units (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
  `);

  const initialUnits = [
    { code: "MT", name: "Per MT (Metric Ton)", description: "Purchase import volume based billing", isActive: true },
    { code: "Month", name: "Per Month / Return", description: "Monthly VAT return filing and compliance", isActive: true },
    { code: "Entry", name: "Per Entry / Invoice", description: "Per invoice or transaction entry fee", isActive: true },
    { code: "Job", name: "Per Job / One-time", description: "One-time assignment or statutory registration fee", isActive: true },
    { code: "PCS", name: "Per Piece / Item", description: "Per piece or item calculation", isActive: true },
    { code: "Fixed", name: "Flat / Fixed Fee", description: "Fixed lump sum fee for services", isActive: true },
    { code: "Hour", name: "Per Hour", description: "Hourly professional consultancy rate", isActive: true },
    { code: "Year", name: "Per Year / Annual", description: "Annual audit or retainer fee", isActive: true }
  ];

  for (const u of initialUnits) {
    await db.execute(sql`
      INSERT INTO service_units (code, name, description, is_active)
      VALUES (${u.code}, ${u.name}, ${u.description}, ${u.isActive})
      ON CONFLICT (code) DO UPDATE 
      SET name = EXCLUDED.name, description = EXCLUDED.description;
    `);
  }

  console.log("service_units table created and seeded successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
