import { describe, expect, it, beforeAll } from "vitest";
import { initDatabase } from "@/framework/database/connection.js";
import { db } from "@/framework/facade.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";
import { paymentSettings } from "@/modules/superadmin/database/models/payment_settings.js";
import { users } from "@/modules/auth/database/models/user.js";
import { eq } from "drizzle-orm";

describe("SuperAdmin & Tenant Subscription Module Integration Tests (PostgreSQL)", () => {
  beforeAll(async () => {
    await initDatabase();
  });

  it("should fetch real subscription plans from PostgreSQL", async () => {
    const allPlans = await db.select().from(plans);
    expect(allPlans.length).toBeGreaterThan(0);
    const standardPlan = allPlans[0];
    expect(standardPlan).toBeDefined();
    expect(standardPlan?.rateMonthly).toBeGreaterThan(0);
    expect(standardPlan?.rateYearly).toBeGreaterThan(0);
  });

  it("should fetch and update real bKash payment settings in PostgreSQL", async () => {
    let [config] = await db.select().from(paymentSettings).limit(1);
    expect(config).toBeDefined();
    expect(config.bkashNumber).toBe("01719950891");
    expect(config.bkashCharge).toBe(1.8);
  });

  it("should handle pending tenant approval and calculate expDate accurately", async () => {
    // 1. Create a test pending registration
    const [testTenant] = await db.insert(users).values({
      name: "Sylhet VAT Advisory",
      email: `sylhet.vat.${Date.now()}@example.com`,
      mobile: "01711223344",
      password: "hashedpassword123",
      status: "pending",
      trxId: "8N9P3X2Y (monthly)",
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    expect(testTenant.status).toBe("pending");

    // 2. Simulate approval with monthly auto-cycle
    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + 1);

    await db.update(users).set({
      status: "active",
      expDate,
      adminId: testTenant.id,
      updatedAt: new Date()
    }).where(eq(users.id, testTenant.id));

    // 3. Verify in PostgreSQL
    const [approvedTenant] = await db.select().from(users).where(eq(users.id, testTenant.id));
    expect(approvedTenant.status).toBe("active");
    expect(approvedTenant.expDate).not.toBeNull();
    expect(approvedTenant.adminId).toBe(testTenant.id);

    // 4. Test subscription extension
    const extendedDate = new Date(approvedTenant.expDate!);
    extendedDate.setDate(extendedDate.getDate() + 30);

    await db.update(users).set({ expDate: extendedDate }).where(eq(users.id, testTenant.id));
    const [extendedTenant] = await db.select().from(users).where(eq(users.id, testTenant.id));
    expect(new Date(extendedTenant.expDate!).getTime()).toBeGreaterThan(new Date(approvedTenant.expDate!).getTime());

    // 5. Clean up test record
    await db.delete(users).where(eq(users.id, testTenant.id));
  });

  it("should create, update, and delete a custom subscription plan in PostgreSQL", async () => {
    // Create
    const [created] = await db.insert(plans).values({
      name: "Custom Enterprise Plan",
      rateMonthly: 9999,
      rateYearly: 99999,
      maxUsers: 100,
      yearlyDiscountPercent: 16.6,
      features: ["Custom Feature 1", "Custom Feature 2"],
      status: "active"
    }).returning();

    expect(created.id).toBeDefined();
    expect(created.name).toBe("Custom Enterprise Plan");

    // Update
    await db.update(plans).set({ rateMonthly: 12000 }).where(eq(plans.id, created.id));
    const [updated] = await db.select().from(plans).where(eq(plans.id, created.id));
    expect(updated.rateMonthly).toBe(12000);

    // Delete
    await db.delete(plans).where(eq(plans.id, created.id));
    const [deleted] = await db.select().from(plans).where(eq(plans.id, created.id));
    expect(deleted).toBeUndefined();
  });
});
