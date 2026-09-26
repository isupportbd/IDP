import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { jwtConfig } from "@/config/index.js";
import { cookie, db, jwt } from "@/framework/facade.js";
import { refreshTokens } from "@/modules/auth/database/models/user.js";

import { users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";

/**
 * Why: Removes sensitive/internal fields before returning user payload.
 * When: Used in auth responses like register/login/me.
 * Where: Called by auth.controller handlers.
 */
import { subscriptionTransactions } from "@/modules/superadmin/database/models/subscription_transactions.js";

/**
 * Why: Removes sensitive/internal fields before returning user payload, computes wallet balance & auto-renews.
 * When: Used in auth responses like register/login/me.
 * Where: Called by auth.controller handlers.
 */
export async function sanitizeUser(user: any) {
  let plan = null;
  let requiredPlanPrice = 0;
  let isYearly = (user.billingCycle === "yearly");

  try {
    const effectivePlanId = user.planId || (user.adminId ? (await db.query.users.findFirst({ where: eq(users.id, user.adminId) }))?.planId : null);
    if (effectivePlanId) {
      const [foundPlan] = await db.select().from(plans).where(eq(plans.id, effectivePlanId));
      if (foundPlan) {
        plan = {
          id: foundPlan.id,
          name: foundPlan.name,
          rateMonthly: foundPlan.rateMonthly,
          rateYearly: foundPlan.rateYearly,
          maxUsers: foundPlan.maxUsers,
          maxClients: foundPlan.maxClients,
          maxStorageMB: foundPlan.maxStorageMB,
          hasAccounts: foundPlan.hasAccounts,
          yearlyDiscountPercent: foundPlan.yearlyDiscountPercent,
          features: foundPlan.features
        };
        requiredPlanPrice = isYearly ? foundPlan.rateYearly : foundPlan.rateMonthly;
      }
    }
  } catch (e) {
    console.error("Error fetching plan for user:", e);
  }

  // Auto-renewal check: If expired or never activated, but wallet balance covers requiredPlanPrice
  const isExpired = !user.expDate || new Date(user.expDate) <= new Date();
  if (user.planId && requiredPlanPrice > 0 && isExpired && (user.advanceBalance || 0) >= requiredPlanPrice) {
    try {
      const newBalance = (user.advanceBalance || 0) - requiredPlanPrice;
      const newExp = new Date();
      if (isYearly) {
        newExp.setFullYear(newExp.getFullYear() + 1);
      } else {
        newExp.setMonth(newExp.getMonth() + 1);
      }

      await db
        .update(users)
        .set({
          advanceBalance: newBalance,
          expDate: newExp,
          status: "active",
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

      await db.insert(subscriptionTransactions).values({
        userId: user.id,
        planId: user.planId,
        type: "renewal_fee",
        billingCycle: user.billingCycle || "monthly",
        grossAmount: requiredPlanPrice,
        gatewayCharge: 0,
        netAmount: -requiredPlanPrice,
        planRate: requiredPlanPrice,
        paidAmount: requiredPlanPrice,
        daysAdded: isYearly ? 365 : 30,
        status: "completed",
        note: "Auto-renewed subscription from prepaid wallet balance"
      });

      user.advanceBalance = newBalance;
      user.expDate = newExp;
    } catch (renewErr) {
      console.error("Failed to auto-renew user plan:", renewErr);
    }
  }

  let effectiveAdvanceBalance = user.advanceBalance ?? 0;
  let effectiveSmsBalance = (user as any).smsBalance ?? 0;

  if (user.adminId) {
    try {
      const adminUser = await db.query.users.findFirst({
        where: eq(users.id, Number(user.adminId))
      });
      if (adminUser) {
        effectiveAdvanceBalance = adminUser.advanceBalance ?? 0;
        effectiveSmsBalance = (adminUser as any).smsBalance ?? 0;
      }
    } catch {}
  }

  const isSubscriptionActive = !!(user.expDate && new Date(user.expDate) > new Date());
  const shortage = isSubscriptionActive ? 0 : Math.max(0, requiredPlanPrice - effectiveAdvanceBalance);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile ?? null,
    status: user.status ?? "active",
    planId: user.planId ?? null,
    billingCycle: user.billingCycle || "monthly",
    advanceBalance: effectiveAdvanceBalance,
    smsBalance: effectiveSmsBalance,
    planPrice: requiredPlanPrice,
    shortage,
    isSubscriptionActive,
    adminId: user.adminId ?? null,
    expDate: user.expDate ? String(user.expDate) : null,
    plan,
    emailVerifiedAt: user.emailVerifiedAt ? String(user.emailVerifiedAt) : null,
    roleId: user.roleId ?? null,
    role: user.role || null,
    permissions: user.permissions || null,
    createdAt: user.createdAt ? String(user.createdAt) : null,
    updatedAt: user.updatedAt ? String(user.updatedAt) : null
  };
}

/**
 * Why: Creates a cryptographically secure password reset token.
 * When: Used during forgot-password flow before hashing/storing.
 * Where: Called by forgotPassword handler.
 */
export function makeResetToken() {
  return randomBytes(32).toString("hex");
}

export function makeEmailVerificationToken() {
  return randomBytes(32).toString("hex");
}

/**
 * Why: Hashes reset token so plain token is never stored in DB.
 * When: Used for insert and verification in reset flow.
 * Where: Called by forgotPassword/resetPassword handlers.
 */
export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Why: Revokes currently active refresh token from cookie context.
 * When: Used before issuing new tokens or during logout.
 * Where: Called by register/login/logout flows.
 */
export async function revokeCurrentRefreshToken(c: any) {
  const token = await cookie.getRefresh(c);
  if (!token) return;

  const payload = await jwt.verifyToken(token, "refresh");
  if (payload?.jti) {
    await db.delete(refreshTokens).where(eq(refreshTokens.jti, payload.jti as string));
  }
}

/**
 * Why: Issues access+refresh tokens, persists refresh token, sets cookies.
 * When: Used after successful auth actions (register/login/refresh patterns).
 * Where: Called by auth.controller handlers.
 */
export async function issueTokens(c: any, user: any, options?: { remember?: boolean }) {
  const remember = !!options?.remember;
  const refreshExpiry = remember ? jwtConfig.refreshRememberExpirySeconds : jwtConfig.refreshExpirySeconds;
  const role = user.role || null;
  const accessToken = await jwt.generateToken(
    {
      id: user.id,
      email: user.email,
      roleId: role?.id ?? null,
      role: role?.name ?? null,
      remember
    },
    "access"
  );
  const refreshToken = await jwt.generateToken(
    {
      id: user.id,
      email: user.email,
      roleId: role?.id ?? null,
      role: role?.name ?? null,
      remember
    },
    "refresh",
    refreshExpiry
  );

  if (refreshToken.jti) {
    await db.insert(refreshTokens).values({
      userId: user.id,
      jti: refreshToken.jti,
      revoked: false,
      expiresAt: new Date(refreshToken.exp * 1000)
    });
  }

  await cookie.setAuth(c, accessToken.token);
  await cookie.setRefresh(c, refreshToken.token, refreshExpiry);

  return { accessToken: accessToken.token, refreshToken: refreshToken.token };
}
