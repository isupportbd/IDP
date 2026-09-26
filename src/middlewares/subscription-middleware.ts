import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";

export async function subscriptionMiddleware(c: Context, next: Next) {
  const auth = c.get("auth") as any;
  if (!auth) {
    return await next();
  }

  // SuperAdmin is exempt from subscription restrictions
  if (auth.role === "superadmin" || auth.roleId === 1) {
    return await next();
  }

  // Exempt read-only HTTP GET, HEAD, OPTIONS requests so tenants can view data
  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return await next();
  }

  // Exempt wallet recharge route and logout/auth info routes
  const path = c.req.path;
  if (
    path.includes("/recharge-wallet") ||
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

    if (!isSubscriptionActive) {
      let plan = null;
      if (tenantAdmin.planId) {
        const [foundPlan] = await db.select().from(plans).where(eq(plans.id, tenantAdmin.planId));
        plan = foundPlan;
      }
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

    return await next();
  } catch (err) {
    console.error("Subscription middleware check error:", err);
    return await next();
  }
}
