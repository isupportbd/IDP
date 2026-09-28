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

  // 1. Run all base SQL migrations (creates all 32 empty tables cleanly)
  try {
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
    await executeSingleSql(`DELETE FROM column_mappings WHERE db_column = 'client_name'`);
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
