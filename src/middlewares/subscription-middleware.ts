import type { Context, Next } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { purchases } from "@/modules/clients/database/models/purchases.js";
import { vatSubmissions } from "@/modules/clients/database/models/vat_submissions.js";
import { bills } from "@/modules/billing/database/models/bills.js";

export async function subscriptionMiddleware(c: Context, next: Next) {
  const auth = c.get("auth") as any;
  if (!auth) {
    return await next();
  }

  // SuperAdmin is exempt from subscription restrictions
  if (auth.role === "superadmin" || auth.roleId === 1) {
    return await next();
  }

  // Exempt read-only HTTP GET, HEAD, OPTIONS requests so tenants can view data/reports
  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return await next();
  }

  // Exempt wallet recharge, storage purchase, and auth info routes
  const path = c.req.path;
  if (
    path.includes("/recharge-wallet") ||
    path.includes("/buy-storage") ||
    path.includes("/auth/logout") ||
    path.includes("/auth/me") ||
    path.includes("/auth/refresh")
  ) {
    return await next();
  }

  try {
    const currentUserId = auth.id;
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, currentUserId)
    });

    if (!currentUser) {
      return await next();
    }

    const tenantAdminId = currentUser.adminId || currentUser.id;
    const tenantAdmin = currentUser.adminId
      ? await db.query.users.findFirst({ where: eq(users.id, tenantAdminId) })
      : currentUser;

    if (!tenantAdmin || !tenantAdmin.planId) {
      return await next();
    }

    const isSubscriptionActive = !!(
      tenantAdmin.expDate && new Date(tenantAdmin.expDate) > new Date()
    );

    let plan = null;
    if (tenantAdmin.planId) {
      const [foundPlan] = await db.select().from(plans).where(eq(plans.id, tenantAdmin.planId));
      plan = foundPlan;
    }

    // 1. Subscription Inactive Check
    if (!isSubscriptionActive) {
      const isYearly = tenantAdmin.billingCycle === "yearly";
      const planPrice = isYearly ? (plan?.rateYearly || 15000) : (plan?.rateMonthly || 1500);
      const shortage = Math.max(0, planPrice - (tenantAdmin.advanceBalance || 0));

      return c.json(
        {
          success: false,
          isSubscriptionInactive: true,
          shortage,
          advanceBalance: tenantAdmin.advanceBalance || 0,
          planPrice,
          message: `Subscription is not active (Shortage: ৳${shortage}). Please recharge your wallet to activate your plan before performing this action.`
        },
        403
      );
    }

    // 3. Billing Feature Gate — check plan.hasAccounts for /billing routes
    // This replaces the duplicate inline middleware that was in billing/routes/api.ts
    const isBillingRoute = c.req.path.includes("/billing");
    if (isBillingRoute && plan && plan.hasAccounts === false) {
      return c.json(
        {
          success: false,
          isBillingLocked: true,
          message: `Account & Billing access is not included in your current plan (${plan.name}). Please upgrade your subscription plan to access Billing & Collections.`
        },
        403
      );
    }

    // 2. Storage Quota Exhaustion Check on write operations (POST, PUT)
    if (method === "POST" || method === "PUT") {
      const baseStorageMB = plan?.maxStorageMB || 1024;
      const extraStorageMB = tenantAdmin.extraStorageMB || 0;
      const totalStorageMB = baseStorageMB + extraStorageMB;

      let totalRecords = 0;
      try {
        const [pCount] = await db.select({ count: sql<number>`count(*)` }).from(purchases).where(eq(purchases.adminId, tenantAdminId));
        const [cCount] = await db.select({ count: sql<number>`count(*)` }).from(clients).where(eq(clients.createdBy, tenantAdminId));
        const [sCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(vatSubmissions)
          .innerJoin(clients, eq(vatSubmissions.clientId, clients.id))
          .where(eq(clients.createdBy, tenantAdminId));
        const [bCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(bills)
          .innerJoin(clients, eq(bills.clientId, clients.id))
          .where(eq(clients.createdBy, tenantAdminId));
        totalRecords = Number(pCount?.count || 0) + Number(cCount?.count || 0) + Number(sCount?.count || 0) + Number(bCount?.count || 0);
      } catch {}

      const estimatedKB = Math.round(totalRecords * 3.2);
      const usedStorageMB = Number((estimatedKB / 1024).toFixed(2));

      if (totalStorageMB > 0 && usedStorageMB >= totalStorageMB) {
        return c.json(
          {
            success: false,
            isStorageExhausted: true,
            totalStorageMB,
            usedStorageMB,
            message: `Database storage quota reached 100% (${usedStorageMB} MB / ${totalStorageMB} MB). Please purchase extra storage (৳1,000 per 1 GB) to continue adding records.`
          },
          403
        );
      }
    }

    return await next();
  } catch (err) {
    console.error("Subscription middleware check error:", err);
    return await next();
  }
}
