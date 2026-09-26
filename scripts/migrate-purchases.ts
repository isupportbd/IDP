// @ts-nocheck
import { initDatabase } from "../src/framework/database/connection.js";
import { db } from "../src/framework/facade.js";
import { sql } from "drizzle-orm";

async function main() {
  await initDatabase();
  console.log("Creating purchases table in PostgreSQL if not exists...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
      client_id INTEGER NOT NULL REFERENCES clients(id),
      item_id INTEGER NOT NULL REFERENCES global_items(id),
      office VARCHAR(100),
      be_no VARCHAR(100),
      be_date DATE NOT NULL,
      month VARCHAR(7) NOT NULL,
      lc_number VARCHAR(100),
      net_wt DOUBLE PRECISION NOT NULL,
      excess_qty DOUBLE PRECISION,
      total_qty DOUBLE PRECISION,
      ass_value DOUBLE PRECISION NOT NULL,
      unit_value DOUBLE PRECISION,
      cd DOUBLE PRECISION,
      rd DOUBLE PRECISION,
      sd DOUBLE PRECISION,
      base_value_of_vat DOUBLE PRECISION,
      vat DOUBLE PRECISION,
      at DOUBLE PRECISION,
      is_rebate BOOLEAN DEFAULT false,
      is_ffs BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS purchases_admin_id_idx ON purchases(admin_id);
    CREATE INDEX IF NOT EXISTS purchases_client_id_idx ON purchases(client_id);
    CREATE INDEX IF NOT EXISTS purchases_item_id_idx ON purchases(item_id);
    CREATE INDEX IF NOT EXISTS purchases_month_idx ON purchases(month);
    CREATE INDEX IF NOT EXISTS purchases_admin_month_idx ON purchases(admin_id, month);
    CREATE INDEX IF NOT EXISTS purchases_client_month_idx ON purchases(client_id, month);
  `);

  console.log("Purchases table created successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
