import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { sql, eq } from "drizzle-orm";
import { db } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { roles } from "@/modules/auth/database/models/role.js";

async function executeSingleSql(rawSql: string) {
  const clean = rawSql.trim();
  if (!clean) return;
  try {
    await db.execute(sql.raw(clean));
  } catch (err: any) {
    if (
      !err.message?.includes("already exists") &&
      !err.message?.includes("duplicate") &&
      !err.message?.includes("multiple primary keys")
    ) {
      console.warn(`[DB Schema Sync Warning]:`, err.message || err);
    }
  }
}

export async function syncDatabaseSchemaAndSuperAdmin() {
  console.log("[DB Sync] Starting clean schema and SuperAdmin synchronization...");

  // 1. Run all base SQL migrations ONLY if database is fresh/empty
  try {
    let tablesExist = false;
    try {
      const check = await db.execute(sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`);
      const rows = check.rows || check;
      if (Array.isArray(rows) && rows.length > 0) {
        tablesExist = true;
      }
    } catch {
      tablesExist = false;
    }

    if (!tablesExist) {
      console.log("[DB Sync] Fresh database detected, creating all initial tables...");
      const migrationsDir = path.resolve(process.cwd(), "src/database/migrations/postgresql");
      if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
        for (const file of files) {
          const filePath = path.join(migrationsDir, file);
          const sqlContent = fs.readFileSync(filePath, "utf-8");
          const statements = sqlContent.split("--> statement-breakpoint");
          for (const stmt of statements) {
            await executeSingleSql(stmt);
          }
        }
      }
    } else {
      console.log("[DB Sync] Existing database verified (skipping base DDL creation).");
    }
  } catch (mErr) {
    console.warn("[DB Sync Migration Warning]", mErr);
  }

  // 2. Ensure Roles table and cleanup stale mappings
  try {
    await executeSingleSql(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await executeSingleSql(
      `INSERT INTO roles (name) VALUES ('superadmin'), ('admin'), ('user') ON CONFLICT (name) DO NOTHING`
    );
    // Auto-clean stale column mapping entries
    await executeSingleSql(`DELETE FROM column_mappings WHERE db_column IN ('client_name', 'clientName') OR label = 'client_name'`);
    
    // Ensure all plan columns exist
    await executeSingleSql(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_clients INTEGER NOT NULL DEFAULT 50`);
    await executeSingleSql(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_storage_mb INTEGER NOT NULL DEFAULT 1024`);
    await executeSingleSql(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS has_accounts BOOLEAN NOT NULL DEFAULT false`);

    // Ensure tenant admin_id columns exist on firm tables
    await executeSingleSql(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS admin_id INTEGER`);
    await executeSingleSql(`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS admin_id INTEGER`);
    await executeSingleSql(`ALTER TABLE expense_heads ADD COLUMN IF NOT EXISTS admin_id INTEGER`);

    // Ensure SMS tables exist
    await executeSingleSql(`
      CREATE TABLE IF NOT EXISTS sms_templates (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        key VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT,
        body TEXT NOT NULL,
        variables JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await executeSingleSql(`
      CREATE TABLE IF NOT EXISTS sms_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        recipient_mobile VARCHAR(32) NOT NULL,
        message TEXT NOT NULL,
        template_key VARCHAR(64),
        submission_id VARCHAR(64),
        status VARCHAR(32) NOT NULL DEFAULT 'SENT',
        provider_response TEXT,
        sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    // Ensure company_settings has SMS columns
    await executeSingleSql(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS sms_api_key VARCHAR(255)`);
    await executeSingleSql(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS sender_id VARCHAR(255)`);
    await executeSingleSql(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS auto_messaging_enabled BOOLEAN NOT NULL DEFAULT true`);

    // Ensure high-performance composite indexes exist
    await executeSingleSql(`CREATE INDEX IF NOT EXISTS purchases_admin_month_idx ON purchases (admin_id, month)`);
    await executeSingleSql(`CREATE INDEX IF NOT EXISTS purchases_client_month_idx ON purchases (client_id, month)`);
    await executeSingleSql(`CREATE INDEX IF NOT EXISTS purchases_client_be_date_idx ON purchases (client_id, be_date)`);
    await executeSingleSql(`CREATE INDEX IF NOT EXISTS sales_rates_lookup_idx ON sales_rates (client_id, item_id, status, activation_date)`);
    await executeSingleSql(`CREATE INDEX IF NOT EXISTS sms_templates_admin_key_idx ON sms_templates (admin_id, key)`);
    await executeSingleSql(`CREATE INDEX IF NOT EXISTS sms_logs_admin_date_idx ON sms_logs (admin_id, sent_at)`);
  } catch (rErr) {
    console.warn("[DB Roles Warning]", rErr);
  }

  // 3. Dynamic SuperAdmin Account Setup from .env (Only SuperAdmin account, NO demo data)
  try {
    const superadminEmail = (process.env.SUPERADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const superadminPassword = process.env.SUPERADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    const superadminName = process.env.SUPERADMIN_NAME || process.env.ADMIN_NAME || "Super Admin";

    if (superadminEmail && superadminPassword) {
      let [superadminRole] = await db.select().from(roles).where(eq(roles.name, "superadmin")).limit(1);
      if (!superadminRole) {
        try {
          const [createdRole] = await db.insert(roles).values({ name: "superadmin" }).returning();
          superadminRole = createdRole;
        } catch {
          const [existingRole] = await db.select().from(roles).where(eq(roles.name, "superadmin")).limit(1);
          superadminRole = existingRole;
        }
      }

      const hashedPassword = await bcrypt.hash(superadminPassword, 10);
      const existingAdmin = await db.select().from(users).where(sql`lower(${users.email}) = ${superadminEmail}`).limit(1);

      if (existingAdmin.length > 0) {
        console.log(`[SuperAdmin Sync] Updating credentials for ${superadminEmail} from .env...`);
        await db.update(users).set({
          name: superadminName,
          email: superadminEmail,
          password: hashedPassword,
          roleId: superadminRole?.id || existingAdmin[0].roleId,
          status: "active",
          emailVerifiedAt: new Date(),
          updatedAt: new Date()
        }).where(eq(users.id, existingAdmin[0].id));
      } else {
        console.log(`[SuperAdmin Sync] Creating SuperAdmin account for ${superadminEmail} from .env...`);
        await db.insert(users).values({
          name: superadminName,
          email: superadminEmail,
          password: hashedPassword,
          roleId: superadminRole?.id,
          status: "active",
          emailVerifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      console.log(`[SuperAdmin Sync] SuperAdmin account ready & synced: ${superadminEmail}`);
    } else {
      console.warn("[SuperAdmin Sync] No SUPERADMIN_EMAIL / ADMIN_EMAIL configured in environment.");
    }
  } catch (adminErr) {
    console.error("[SuperAdmin Sync Error]", adminErr);
  }

  console.log("[DB Sync] Clean schema synchronization finished (Zero demo data).");
}
