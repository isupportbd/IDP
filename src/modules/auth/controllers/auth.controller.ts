import { and, eq, gt, lt, or } from "drizzle-orm";
import type { Handler } from "hono";
import { authConfig, jwtConfig } from "@/config/index.js";
import { broadcast, cookie, db, dispatchEvent, HttpStatusCodes, jwt, password, urls } from "@/framework/facade.js";
import { roles } from "@/modules/auth/database/models/role.js";
import { emailVerificationTokens, passwordResetTokens, refreshTokens, users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";
import { paymentSettings } from "@/modules/superadmin/database/models/payment_settings.js";
import { subscriptionTransactions } from "@/modules/superadmin/database/models/subscription_transactions.js";
import {
  hashEmailVerificationToken,
  hashResetToken,
  issueTokens,
  makeEmailVerificationToken,
  makeResetToken,
  revokeCurrentRefreshToken,
  sanitizeUser
} from "./auth.helpers.js";
import { dispatchProviderSms, fetchProviderBalance } from "@/framework/sms/index.js";
import { companySettings } from "@/modules/firm/database/models/company_settings.js";

/**
 * Why: Creates a new user, issues tokens, and triggers signup side effects.
 * When: Used on first-time account creation.
 * Where: POST auth register route.
 */
export const register: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");

    // Check if a superadmin exists in system
    const superadminRole = await db.query.roles.findFirst({
      where: eq(roles.name, "superadmin")
    });
    const superadminUser = superadminRole
      ? await db.query.users.findFirst({
        where: eq(users.roleId, superadminRole.id)
      })
      : null;

    const defaultRole = (await db.query.roles.findFirst({
      where: eq(roles.name, "admin")
    })) || (await db.query.roles.findFirst({
      where: eq(roles.name, "user")
    }));

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, body.email)
    });

    if (existingUser) {
      return c.json({ message: "Email already exists" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    const isFirstSuperAdmin = !superadminUser;
    const targetRoleId = isFirstSuperAdmin && superadminRole ? superadminRole.id : (defaultRole?.id ?? null);
    const targetStatus = isFirstSuperAdmin ? "active" : "pending";

    // Validate Plan & Payment for Tenants
    let tenantPlanId = null;
    let tenantBillingCycle = "monthly";
    let tenantPaidAmount = 0;
    let tenantTrxId = null;
    let baseFee = 0;
    let chargePercent = 1.8;

    if (!isFirstSuperAdmin) {
      if (!body.planId) {
        return c.json({ success: false, message: "Please select a plan to sign up." }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
      }

      const [selectedPlan] = await db.select().from(plans).where(eq(plans.id, Number(body.planId)));
      if (!selectedPlan) {
        return c.json({ success: false, message: "Selected plan does not exist." }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
      }

      tenantPlanId = selectedPlan.id;
      tenantBillingCycle = body.billingCycle === "yearly" ? "yearly" : "monthly";

      const [paymentConfig] = await db.select().from(paymentSettings).limit(1);
      chargePercent = paymentConfig?.bkashCharge ?? 1.8;
      baseFee = tenantBillingCycle === "yearly" ? selectedPlan.rateYearly : selectedPlan.rateMonthly;

      const rawPaidAmount = Number(body.paidAmount || 0);
      if (rawPaidAmount < 1) {
        return c.json(
          {
            success: false,
            message: `Please enter the amount paid via bKash.`
          },
          HttpStatusCodes.UNPROCESSABLE_ENTITY
        );
      }

      if (!body.trxId || !body.trxId.trim()) {
        return c.json(
          { success: false, message: "bKash TrxID is required to complete registration." },
          HttpStatusCodes.UNPROCESSABLE_ENTITY
        );
      }

      tenantPaidAmount = rawPaidAmount;
      tenantTrxId = body.trxId.replace(/\s*\((monthly|yearly|m|y)\)/gi, "").trim();
    }

    const insertedRows = await db
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        mobile: body.mobile || null,
        password: await password.hashPassword(body.password),
        roleId: targetRoleId,
        status: targetStatus,
        planId: tenantPlanId,
        billingCycle: isFirstSuperAdmin ? null : tenantBillingCycle,
        trxId: tenantTrxId,
        paidAmount: tenantPaidAmount,
        advanceBalance: 0
      })
      .returning();

    const insertedId = insertedRows[0]?.id;
    if (!insertedId) {
      throw new Error("Failed to resolve inserted user id");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, insertedId),
      with: { role: true }
    });

    if (!user) throw new Error("Inserted user not found");

    if (targetStatus === "pending") {
      // Record initial signup deposit transaction
      try {
        const gwCharge = Math.round((tenantPaidAmount * chargePercent) / 100);
        const netAmt = tenantPaidAmount - gwCharge;
        await db.insert(subscriptionTransactions).values({
          userId: user.id,
          planId: tenantPlanId,
          type: "deposit",
          billingCycle: tenantBillingCycle,
          grossAmount: tenantPaidAmount,
          gatewayCharge: gwCharge,
          netAmount: netAmt,
          planRate: baseFee,
          paidAmount: tenantPaidAmount,
          trxId: tenantTrxId,
          paymentMethod: "bkash",
          status: "pending",
          note: "Initial signup deposit awaiting SuperAdmin verification"
        });
      } catch (txErr) {
        console.error("Failed to insert pending subscription transaction:", txErr);
      }

      try {
        broadcast(
          "tenant:signup",
          {
            id: user.id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            planId: user.planId,
            billingCycle: user.billingCycle,
            trxId: user.trxId,
            paidAmount: user.paidAmount,
            createdAt: user.createdAt
          },
          { roles: ["superadmin"], all: true }
        );
      } catch (broadcastErr) {
        console.error("Broadcast tenant:signup error:", broadcastErr);
      }

      return c.json(
        {
          success: true,
          message: "Registration successful! Please wait for the Super Admin to approve your account.",
          data: {
            user: await sanitizeUser(user)
          }
        },
        HttpStatusCodes.CREATED
      );
    }

    if (authConfig.requireEmailVerification) {
      const plainToken = makeEmailVerificationToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, user.email));
      await db.insert(emailVerificationTokens).values({
        email: user.email,
        token: hashEmailVerificationToken(plainToken),
        expiresAt,
        createdAt: new Date()
      });

      const verifyUrl = urls.url(`/verify-email?token=${plainToken}&email=${encodeURIComponent(user.email)}`);
      await dispatchEvent("user:verify-email", { email: user.email, name: user.name, verifyUrl }, { queue: "mail" });

      return c.json({ message: "User registered successfully. Please verify your email before logging in." }, HttpStatusCodes.CREATED);
    }

    await revokeCurrentRefreshToken(c);
    const tokens = await issueTokens(c, user, { remember: !!body.remember });
    await dispatchEvent(
      "user:signup",
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        password: body.password
      },
      { queue: "mail" }
    );

    return c.json(
      {
        message: "User registered successfully",
        data: {
          user: await sanitizeUser(user),
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: "Bearer"
        }
      },
      HttpStatusCodes.CREATED
    );
  } catch (error) {
    console.error("Register error:", error);
    return c.json({ message: "Failed to register user" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Authenticates user credentials and rotates active login cookies/tokens.
 * When: Used whenever a user signs in.
 * Where: POST auth login route.
 */
export const login: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
      with: { role: true }
    });

    if (!user || !(await password.verifyPassword(body.password, user.password))) {
      return c.json({ message: "Invalid credentials" }, HttpStatusCodes.UNAUTHORIZED);
    }

    if (user.status === "suspended") {
      return c.json({ message: "Your account is suspended. Please contact administrator." }, HttpStatusCodes.FORBIDDEN);
    }

    if (user.status === "pending") {
      return c.json({ message: "Your registration is pending verification and approval." }, HttpStatusCodes.FORBIDDEN);
    }

    if (authConfig.requireEmailVerification && !user.emailVerifiedAt) {
      return c.json({ message: "Please verify your email before logging in" }, HttpStatusCodes.FORBIDDEN);
    }


    await revokeCurrentRefreshToken(c);
    const tokens = await issueTokens(c, user, { remember: !!body.remember });

    return c.json(
      {
        message: "User logged in successfully",
        data: {
          user: await sanitizeUser(user),
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: "Bearer"
        }
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ message: "Failed to login" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Returns the currently authenticated user profile.
 * When: Used by clients to bootstrap session/user state.
 * Where: GET auth me route.
 */
export const me: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");
    const user = await db.query.users.findFirst({
      where: eq(users.id, auth.id),
      with: { role: true }
    });

    if (!user) return c.json({ message: "User not found" }, HttpStatusCodes.NOT_FOUND);

    return c.json(
      {
        message: "Authenticated user fetched successfully",
        data: await sanitizeUser(user)
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Me error:", error);
    return c.json({ message: "Failed to fetch user" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Revokes current refresh token and clears auth cookies.
 * When: Used when the active device logs out.
 * Where: POST auth logout route.
 */
export const logout: Handler = async (c: any) => {
  try {
    await revokeCurrentRefreshToken(c);
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);
    return c.json({ message: "Logged out successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Logout error:", error);
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);
    return c.json({ message: "Failed to logout" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Starts password reset flow and queues email delivery event.
 * When: Used when user requests a forgot-password link.
 * Where: POST auth forgot-password route.
 */
export const forgotPassword: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    await db
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.email, body.email), lt(passwordResetTokens.expiresAt, new Date())));

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email)
    });
    if (!user) return c.json({ message: "If this email exists, a reset link has been sent" }, HttpStatusCodes.OK);

    const plainToken = makeResetToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, user.email));
    await db.insert(passwordResetTokens).values({
      email: user.email,
      token: hashResetToken(plainToken),
      expiresAt,
      createdAt: new Date()
    });

    const resetUrl = urls.url(`/reset-password?token=${plainToken}&email=${encodeURIComponent(user.email)}`);
    await dispatchEvent("user:forget-password", { email: user.email, name: user.name, resetUrl }, { queue: "mail" });

    return c.json({ message: "If this email exists, a reset link has been sent" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Forgot password error:", error);
    return c.json({ message: "Failed to process forgot password request" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Verifies reset token and persists the new password.
 * When: Used after user submits reset token + new password.
 * Where: POST auth reset-password route.
 */
export const resetPassword: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const record = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.email, body.email),
        eq(passwordResetTokens.token, hashResetToken(body.token)),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    });

    if (!record) {
      return c.json({ message: "Invalid or expired reset token" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    await db
      .update(users)
      .set({
        password: await password.hashPassword(body.password),
        updatedAt: new Date()
      })
      .where(eq(users.email, body.email));

    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, body.email));

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email)
    });
    if (user) await db.update(refreshTokens).set({ revoked: 1 }).where(eq(refreshTokens.userId, user.id));

    return c.json({ message: "Password reset successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Reset password error:", error);
    return c.json({ message: "Failed to reset password" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Validates email verification token and marks user as verified.
 * When: Used when user opens verification link from inbox.
 * Where: POST auth verify-email route.
 */
export const verifyEmail: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");

    if (!authConfig.requireEmailVerification) {
      return c.json({ message: "Email verification is not required" }, HttpStatusCodes.OK);
    }

    const record = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.email, body.email),
        eq(emailVerificationTokens.token, hashEmailVerificationToken(body.token)),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    });

    if (!record) {
      return c.json({ message: "Invalid or expired verification token" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.email, body.email));
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, body.email));

    return c.json({ message: "Email verified successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Verify email error:", error);
    return c.json({ message: "Failed to verify email" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Rotates refresh token and reissues access credentials.
 * When: Used when access token expires but refresh token is still valid.
 * Where: POST auth refresh-token route.
 */
export const refreshToken: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const payload = await jwt.verifyToken(body.refresh_token, "refresh");

    if (!payload?.jti) return c.json({ message: "Invalid refresh token" }, HttpStatusCodes.UNAUTHORIZED);

    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.jti, payload.jti as string)
    });

    if (!storedToken || storedToken.revoked === 1) {
      return c.json({ message: "Refresh token revoked" }, HttpStatusCodes.UNAUTHORIZED);
    }

    if (storedToken.expiresAt.getTime() < Date.now()) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
      return c.json({ message: "Refresh token expired" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.id as number),
      with: { role: true }
    });
    if (!user) return c.json({ message: "User not found" }, HttpStatusCodes.UNAUTHORIZED);

    const remember = !!payload.remember;
    const refreshExpiry = remember ? jwtConfig.refreshRememberExpirySeconds : undefined;
    const accessToken = await jwt.generateToken(
      {
        id: user.id,
        email: user.email,
        roleId: user.role?.id,
        role: user.role?.name,
        remember
      },
      "access"
    );
    const newRefreshToken = await jwt.generateToken(
      {
        id: user.id,
        email: user.email,
        roleId: user.role?.id,
        role: user.role?.name,
        remember
      },
      "refresh",
      refreshExpiry
    );

    await db
      .update(refreshTokens)
      .set({
        jti: newRefreshToken.jti as string,
        expiresAt: new Date(newRefreshToken.exp * 1000),
        revoked: 0
      })
      .where(eq(refreshTokens.id, storedToken.id));

    await cookie.setAuth(c, accessToken.token);
    await cookie.setRefresh(c, newRefreshToken.token, refreshExpiry);

    return c.json(
      {
        message: "Token refreshed successfully",
        data: {
          user: sanitizeUser(user),
          access_token: accessToken.token,
          refresh_token: newRefreshToken.token,
          token_type: "Bearer"
        }
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Refresh token error:", error);
    return c.json({ message: "Invalid or expired refresh token" }, HttpStatusCodes.UNAUTHORIZED);
  }
};

/**
 * Why: Revokes all refresh tokens for account-wide logout.
 * When: Used for "logout from all devices" security action.
 * Where: POST auth logout-all-devices route.
 */
export const logoutAllDevices: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");

    if (!auth) return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, auth.id));
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);

    return c.json({ message: "Logged out from all devices successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Logout all devices error:", error);
    return c.json({ message: "Failed to logout from all devices" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Allows a Tenant (Admin) to submit a wallet recharge request via bKash.
 * When: Tenant needs to cover subscription shortage or add prepaid balance.
 * Where: POST /api/auth/recharge-wallet route.
 */
export const rechargeWallet: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");
    if (!auth || !auth.id) {
      return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const body = await c.req.json();
    const paidAmount = Number(body?.paidAmount);
    const trxId = body?.trxId ? String(body.trxId).trim() : "";

    if (!paidAmount || isNaN(paidAmount) || paidAmount <= 0) {
      return c.json({ success: false, message: "Valid paid amount is required" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    if (!trxId) {
      return c.json({ success: false, message: "bKash TrxID is required" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    const [user] = await db.select().from(users).where(eq(users.id, Number(auth.id)));
    if (!user) {
      return c.json({ success: false, message: "User not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const [paymentConfig] = await db.select().from(paymentSettings).limit(1);
    const chargePercent = paymentConfig?.bkashCharge ?? 1.8;
    const gatewayCharge = Math.round((paidAmount * chargePercent) / 100);
    const netAmount = paidAmount - gatewayCharge;

    const [inserted] = await db
      .insert(subscriptionTransactions)
      .values({
        userId: user.id,
        planId: user.planId || null,
        type: "deposit",
        billingCycle: user.billingCycle || "monthly",
        grossAmount: paidAmount,
        gatewayCharge,
        netAmount,
        planRate: 0,
        paidAmount,
        trxId,
        paymentMethod: "bkash",
        status: "pending",
        note: "Wallet recharge request awaiting verification"
      })
      .returning();

    try {
      broadcast(
        "tenant:recharge",
        {
          transactionId: inserted.id,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          paidAmount,
          gatewayCharge,
          netAmount,
          trxId,
          createdAt: inserted.createdAt
        },
        { roles: ["superadmin"], all: true }
      );
    } catch (err) {
      console.error("Broadcast recharge error:", err);
    }

    return c.json({
      success: true,
      message: "Recharge request submitted successfully! SuperAdmin will verify your payment.",
      data: inserted
    });
  } catch (error: any) {
    console.error("Error submitting recharge:", error);
    return c.json({ success: false, message: error.message || "Failed to submit recharge" }, 500);
  }
};

/**
 * Why: Returns live online & active user stats for Admin / SuperAdmin headers.
 * When: Called periodically by Header.vue to show live active & online counter.
 * Where: GET /api/auth/users-stats
 */
export const getUserStats: Handler = async (c: any) => {
  try {
    const auth = c.get("auth") || c.get("user");
    if (!auth || !auth.id) {
      return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const currentUserId = Number(auth.id);

    // Fetch fresh user record from DB to ensure live adminId & role
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, currentUserId),
      with: { role: true }
    });

    if (!currentUser) {
      return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const currentUserRole = currentUser.role?.name || currentUser.role?.slug || "user";
    const isSuperAdmin = currentUserRole === "superadmin";

    // Update current user's updatedAt as heartbeat
    try {
      await db.update(users).set({ updatedAt: new Date() }).where(eq(users.id, currentUserId));
    } catch { }

    let rawUsers: any[] = [];
    if (isSuperAdmin) {
      // SuperAdmin sees all system users
      rawUsers = await db.query.users.findMany({
        with: { role: true }
      });
    } else {
      // For Admin and User:
      // If user is a regular operator, currentUser.adminId points to their Admin.
      // If user is the Admin (Firm Owner), targetAdminId is currentUserId.
      const targetAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUserId;
      rawUsers = await db.query.users.findMany({
        where: or(eq(users.adminId, targetAdminId), eq(users.id, targetAdminId)),
        with: { role: true }
      });
    }

    // Deduplicate distinct user accounts by ID
    const uniqueMap = new Map<number, any>();
    for (const u of rawUsers) {
      if (!uniqueMap.has(u.id)) {
        uniqueMap.set(u.id, u);
      }
    }
    const userList = Array.from(uniqueMap.values());

    const now = new Date().getTime();
    let activeCount = 0;
    let onlineCount = 0;

    const formattedUsers = userList.map((u: any) => {
      const lastActiveTime = u.updatedAt ? new Date(u.updatedAt).getTime() : 0;
      const diffMinutes = lastActiveTime > 0 ? (now - lastActiveTime) / (1000 * 60) : 999999;

      const isSelf = u.id === currentUserId;
      const isStatusActive = u.status === "active";
      const isActive = isSelf || (diffMinutes <= 5 && isStatusActive);
      const isOnline = isSelf || (diffMinutes <= 30 && isStatusActive);

      if (isActive) activeCount++;
      if (isOnline) onlineCount++;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        role: u.role?.name || u.role?.slug || "user",
        status: u.status,
        isActive,
        isOnline,
        updatedAt: u.updatedAt ? String(u.updatedAt) : null
      };
    });

    // Priority sort: Active first, then Online, then recently active, then alphabetical
    formattedUsers.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });

    return c.json({
      success: true,
      stats: {
        active: activeCount,
        online: onlineCount,
        users: formattedUsers
      }
    });
  } catch (err: any) {
    console.error("Error fetching user stats:", err);
    return c.json({ success: false, message: err.message || "Failed to fetch stats" }, 500);
  }
};

/**
 * Why: Sends a test SMS and broadcasts real-time SMS balance update across firm users.
 * When: Triggered when admin tests SMS gateway or dispatches SMS notifications.
 * Where: POST /api/auth/send-test-sms
 */
export const sendTestSms: Handler = async (c: any) => {
  try {
    const auth = c.get("auth") || c.get("user");
    if (!auth || !auth.id) {
      return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const currentUserId = Number(auth.id);
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, currentUserId)
    });

    if (!currentUser) {
      return c.json({ success: false, message: "User not found" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const targetAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUserId;
    const adminUser = currentUser.adminId
      ? await db.query.users.findFirst({ where: eq(users.id, targetAdminId) })
      : currentUser;

    if (!adminUser) {
      return c.json({ success: false, message: "Admin account not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const body = await c.req.json().catch(() => ({}));
    const firmSetting = (await db.select().from(companySettings).limit(1))[0];
    const mobile = body?.mobile || adminUser.mobile || "01819234567";
    const apiKey = body?.apiKey || (adminUser as any).smsApiKey || firmSetting?.smsApiKey;
    const senderId = body?.senderId || (adminUser as any).smsSenderId || firmSetting?.smsSenderId || "VAT-IDP";
    const message = body?.message || "Test SMS from VAT IDP Portal. Your SMS gateway is active and live stock is synced.";

    let newSmsBalance = Math.max(0, ((adminUser as any).smsBalance ?? 0) - 1);

    // If SMS Provider API key is provided, transmit directly and fetch live remaining balance from provider
    if (apiKey) {
      const providerRes = await dispatchProviderSms({
        apiKey,
        senderId,
        mobile,
        message
      });

      if (providerRes.liveBalance !== undefined) {
        newSmsBalance = providerRes.liveBalance;
      }

      await db.update(users).set({ smsBalance: newSmsBalance, updatedAt: new Date() }).where(eq(users.id, targetAdminId));

      try {
        broadcast(
          "tenant:sms-updated",
          {
            adminId: targetAdminId,
            smsBalance: newSmsBalance,
            timestamp: Date.now()
          },
          { all: true, auth: true }
        );
      } catch (bErr) {
        console.error("Broadcast SMS update error:", bErr);
      }

      if (!providerRes.success) {
        return c.json({
          success: false,
          message: providerRes.message || "SMS Provider rejected request",
          smsBalance: newSmsBalance
        }, 400);
      }

      return c.json({
        success: true,
        message: providerRes.message || "SMS sent successfully and real-time stock synced",
        smsBalance: newSmsBalance
      });
    }

    await db.update(users).set({ smsBalance: newSmsBalance, updatedAt: new Date() }).where(eq(users.id, targetAdminId));

    try {
      broadcast(
        "tenant:sms-updated",
        {
          adminId: targetAdminId,
          smsBalance: newSmsBalance,
          timestamp: Date.now()
        },
        { all: true, auth: true }
      );
    } catch (bErr) {
      console.error("Broadcast SMS update error:", bErr);
    }

    return c.json({
      success: true,
      message: "Test SMS triggered (No Gateway API Key configured in Firm Settings)",
      smsBalance: newSmsBalance
    });
  } catch (err: any) {
    console.error("sendTestSms error:", err);
    return c.json({ success: false, message: err.message || "Failed to dispatch test SMS" }, 500);
  }
};

