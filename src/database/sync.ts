import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { sql, eq } from "drizzle-orm";
import { db } from "@/framework/facade.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";
import { paymentSettings } from "@/modules/superadmin/database/models/payment_settings.js";
import { users } from "@/modules/auth/database/models/user.js";
import { roles } from "@/modules/auth/database/models/role.js";
import { customerTypes } from "@/modules/services/database/models/customer_types.js";

export async function syncDatabaseSchemaAndSuperAdmin() {
  try {
    console.log("[DB Sync] Checking and syncing database tables...");

    // 1. Run all base SQL migrations if PostgreSQL
    const migrationsDir = path.resolve(process.cwd(), "src/database/migrations/postgresql");
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
      for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, "utf-8");
        const statements = sqlContent.split("--> statement-breakpoint");
        for (const stmt of statements) {
          const cleanStmt = stmt.trim();
          if (cleanStmt) {
            try {
              await db.execute(sql.raw(cleanStmt));
            } catch (e: any) {
              if (!e.message?.includes("already exists") && !e.message?.includes("duplicate")) {
                console.warn(`[Migration notice: ${file}]`, e.message);
              }
            }
          }
        }
      }
    }

    // 2. Ensure SuperAdmin, Roles & Subscription tables exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        rate_monthly DOUBLE PRECISION NOT NULL,
        rate_yearly DOUBLE PRECISION NOT NULL,
        max_users INTEGER NOT NULL DEFAULT 1,
        yearly_discount_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
        features JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_settings (
        id SERIAL PRIMARY KEY,
        bkash_number VARCHAR(50) NOT NULL DEFAULT '01719950891',
        bkash_charge DOUBLE PRECISION NOT NULL DEFAULT 1.8,
        nagad_number VARCHAR(50),
        rocket_number VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscription_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
        billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
        plan_rate INTEGER NOT NULL DEFAULT 0,
        paid_amount INTEGER NOT NULL DEFAULT 0,
        excess_credit INTEGER NOT NULL DEFAULT 0,
        trx_id VARCHAR(100),
        payment_method VARCHAR(50) NOT NULL DEFAULT 'bkash',
        days_added INTEGER DEFAULT 30,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      INSERT INTO roles (name) VALUES ('superadmin'), ('admin'), ('user') ON CONFLICT (name) DO NOTHING;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trx_id VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_amount INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS advance_balance INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_balance DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS exp_date TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_storage_mb INTEGER NOT NULL DEFAULT 0;

      ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS type VARCHAR(30) NOT NULL DEFAULT 'deposit';
      ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS gross_amount INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS gateway_charge DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS net_amount INTEGER NOT NULL DEFAULT 0;
    `);

    // 3. Seed real plans if not exist
    const existingPlans = await db.select().from(plans);
    if (existingPlans.length === 0) {
      await db.insert(plans).values([
        {
          name: "Standard Firm Plan",
          rateMonthly: 1500,
          rateYearly: 15000,
          maxUsers: 5,
          yearlyDiscountPercent: 17,
          features: [
            "Full Client Profile & BIN Management",
            "Unlimited Purchases & Sales Rates",
            "Submissions & Return Tracker",
            "Activity Matrix & Filtering",
            "Automated VAT Invoices & Billing"
          ],
          status: "active"
        },
        {
          name: "Professional VAT Consultant",
          rateMonthly: 2500,
          rateYearly: 24000,
          maxUsers: 15,
          yearlyDiscountPercent: 20,
          features: [
            "Everything in Standard Plan",
            "Multi-User & Manager Assignments",
            "Mushak 6.2 & 6.2.1 Books Generator",
            "Batch BIN Extractor & Formatter",
            "Priority Technical & VAT Support"
          ],
          status: "active"
        },
        {
          name: "Enterprise Audit Suite",
          rateMonthly: 4500,
          rateYearly: 42000,
          maxUsers: 50,
          yearlyDiscountPercent: 22,
          features: [
            "Everything in Professional Plan",
            "Unlimited Staff & Operator Accounts",
            "Global Audit & Purchases Analytics",
            "Automated Data Reconciliation",
            "Dedicated Account Manager"
          ],
          status: "active"
        }
      ]);
    }

    // 4. Seed Payment Config if not exist
    const existingPayment = await db.select().from(paymentSettings);
    if (existingPayment.length === 0) {
      await db.insert(paymentSettings).values({
        bkashNumber: "01719950891",
        bkashCharge: 1.8,
        nagadNumber: "01819234567"
      });
    }

    // 5. Seed Customer Types if not exist
    const defaultTypes = [
      { typeName: "Importer", description: "Standard import client" },
      { typeName: "Commercial Importer", description: "Commercial import business" },
      { typeName: "Manufacturer", description: "Manufacturing & production entity" },
      { typeName: "Trader", description: "General trading & distribution" },
      { typeName: "Exporter", description: "Export-oriented firm" },
      { typeName: "Service Provider", description: "Service and consultancy provider" }
    ];
    for (const item of defaultTypes) {
      try {
        await db.insert(customerTypes).values({
          typeName: item.typeName,
          description: item.description,
          isActive: true
        }).onConflictDoNothing();
      } catch {}
    }

    // 6. Dynamic SuperAdmin Account Setup from .env
    const superadminEmail = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
    const superadminPassword = process.env.SUPERADMIN_PASSWORD;
    const superadminName = process.env.SUPERADMIN_NAME || "Super Admin";

    if (superadminEmail && superadminPassword) {
      const [superadminRole] = await db.select().from(roles).where(eq(roles.name, "superadmin")).limit(1);
      const hashedPassword = await bcrypt.hash(superadminPassword, 10);

      const existingAdmin = await db.select().from(users).where(eq(users.email, superadminEmail)).limit(1);
      if (existingAdmin.length > 0) {
        console.log(`[SuperAdmin Sync] Updating credentials for ${superadminEmail} from .env...`);
        await db.update(users).set({
          name: superadminName,
          password: hashedPassword,
          roleId: superadminRole?.id || existingAdmin[0].roleId,
          status: "active",
          updatedAt: new Date()
        }).where(eq(users.email, superadminEmail));
      } else {
        console.log(`[SuperAdmin Sync] Creating SuperAdmin account for ${superadminEmail} from .env...`);
        await db.insert(users).values({
          name: superadminName,
          email: superadminEmail,
          password: hashedPassword,
          roleId: superadminRole?.id,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      console.log(`[SuperAdmin Sync] SuperAdmin account ready: ${superadminEmail}`);
    } else {
      console.warn("[SuperAdmin Sync] SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not found in environment variables.");
    }
  } catch (err: any) {
    console.error("[DB Sync Error]", err);
  }
}
