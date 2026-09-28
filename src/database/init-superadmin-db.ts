import bcrypt from "bcryptjs";
import { initDatabase } from "../framework/database/connection.js";
import { db } from "../framework/facade.js";
import { sql, eq } from "drizzle-orm";
import { plans } from "../modules/superadmin/database/models/plans.js";
import { paymentSettings } from "../modules/superadmin/database/models/payment_settings.js";
import { users } from "../modules/auth/database/models/user.js";
import { roles } from "../modules/auth/database/models/role.js";

async function main() {
  await initDatabase();
  console.log("Setting up SuperAdmin & Subscription database tables in PostgreSQL...");

  // 1. Create tables if not exist
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
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_settings (
      id SERIAL PRIMARY KEY,
      bkash_number VARCHAR(50) NOT NULL DEFAULT '01719950891',
      bkash_charge DOUBLE PRECISION NOT NULL DEFAULT 1.8,
      nagad_number VARCHAR(50),
      rocket_number VARCHAR(50),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
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
  `);

  // Drop redundant client_types table if created earlier (we use canonical customer_types)
  await db.execute(sql`
    DROP TABLE IF EXISTS client_types;
  `);

  // 2. Add columns to users table if not exist
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trx_id VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_amount INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS advance_balance INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS exp_date TIMESTAMP;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_storage_mb INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS type VARCHAR(30) NOT NULL DEFAULT 'deposit';
    ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS gross_amount INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS gateway_charge DOUBLE PRECISION NOT NULL DEFAULT 0;
    ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS net_amount INTEGER NOT NULL DEFAULT 0;

    UPDATE users SET billing_cycle = 'yearly' WHERE trx_id ILIKE '%yearly%' OR trx_id ILIKE '%(y)%';
    UPDATE users SET billing_cycle = 'monthly' WHERE billing_cycle IS NULL OR billing_cycle = '';
    UPDATE users SET trx_id = TRIM(REGEXP_REPLACE(trx_id, '\\s*\\((monthly|yearly|m|y)\\)', '', 'gi')) WHERE trx_id IS NOT NULL;
  `);

  // 3. Seed real plans if not exist
  const existingPlans = await db.select().from(plans);
  if (existingPlans.length === 0) {
    console.log("Seeding subscription plans...");
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

  // 4. Seed Payment Config
  const existingPayment = await db.select().from(paymentSettings);
  if (existingPayment.length === 0) {
    console.log("Seeding default payment settings...");
    await db.insert(paymentSettings).values({
      bkashNumber: "01719950891",
      bkashCharge: 1.8,
      nagadNumber: "01819234567"
    });
  }

  // 5. Dynamic SuperAdmin Account Setup from .env (Zero hardcoding)
  const superadminEmail = process.env.SUPERADMIN_EMAIL?.trim()?.toLowerCase();
  const superadminPassword = process.env.SUPERADMIN_PASSWORD;
  const superadminName = process.env.SUPERADMIN_NAME || "Super Admin";

  if (superadminEmail && superadminPassword) {
    // Ensure roles table exists and has superadmin role
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      INSERT INTO roles (name) VALUES ('superadmin'), ('admin'), ('user') ON CONFLICT (name) DO NOTHING;
    `);

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
      console.log(`[SuperAdmin Sync] Creating new SuperAdmin account for ${superadminEmail} from .env...`);
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
  } else {
    console.log("[SuperAdmin Sync] No SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD set in .env. Skipping superadmin user creation.");
  }

  console.log("SuperAdmin & database initialization complete!");
  process.exit(0);
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
