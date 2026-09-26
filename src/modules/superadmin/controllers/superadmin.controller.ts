import { broadcast, db } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { roles } from "@/modules/auth/database/models/role.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";
import { paymentSettings } from "@/modules/superadmin/database/models/payment_settings.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { vatSubmissions } from "@/modules/clients/database/models/vat_submissions.js";
import { bills } from "@/modules/billing/database/models/bills.js";
import { customerTypes } from "@/modules/services/database/models/customer_types.js";
import { clientReferences } from "@/modules/services/database/models/references.js";
import { locations, commercialAreas } from "@/modules/superadmin/database/models/locations.js";
import { columnMappings } from "@/modules/superadmin/database/models/column_mappings.js";
import { globalItems } from "@/modules/superadmin/database/models/global_items.js";
import { measurementUnits } from "@/modules/superadmin/database/models/measurement_units.js";
import { vatNotes } from "@/modules/superadmin/database/models/vat_notes.js";
import { unitConversions } from "@/modules/superadmin/database/models/unit_conversions.js";
import { subscriptionTransactions } from "@/modules/superadmin/database/models/subscription_transactions.js";
import { serviceUnits } from "@/modules/services/database/models/service_units.js";
import { eq, desc, asc, and, or, ne, isNotNull, isNull, sql } from "drizzle-orm";
import type { Context } from "hono";

export function notifySettingsUpdated(settingType: string) {
  try {
    broadcast("global:settings-updated", { type: settingType, timestamp: Date.now() }, { all: true, auth: true });
  } catch (err) {
    console.error(`Failed to broadcast ${settingType} update:`, err);
  }
}


// 1. Get All Active Tenants (Firm Admins)
export async function getTenants(c: Context) {
  try {
    const superadminRole = await db.query.roles.findFirst({
      where: eq(roles.name, "superadmin")
    });
    const superadminRoleId = superadminRole?.id ?? -1;

    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        status: users.status,
        planId: users.planId,
        billingCycle: users.billingCycle,
        trxId: users.trxId,
        paidAmount: users.paidAmount,
        advanceBalance: users.advanceBalance,
        expDate: users.expDate,
        createdAt: users.createdAt,
        roleName: roles.name
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          ne(users.status, "pending"),
          or(ne(users.roleId, superadminRoleId), isNull(users.roleId))
        )
      )
      .orderBy(desc(users.createdAt));


    // Attach client counts and plan details
    const tenantList = await Promise.all(
      allUsers.map(async (t) => {
        const [clientCountResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(clients);

        let plan = null;
        if (t.planId) {
          const [foundPlan] = await db.select().from(plans).where(eq(plans.id, t.planId));
          plan = foundPlan;
        }

        return {
          ...t,
          clientsCount: Number(clientCountResult?.count || 0),
          planName: plan?.name || "Standard Firm Plan",
          planMaxUsers: plan?.maxUsers || 5,
          planMaxClients: plan?.maxClients || 50,
          planMaxStorageMB: plan?.maxStorageMB || 1024,
          planHasAccounts: plan?.hasAccounts ?? false
        };
      })
    );

    return c.json({ success: true, data: tenantList });
  } catch (error: any) {
    console.error("Error fetching tenants:", error);
    return c.json({ success: false, error: "Failed to fetch tenants" }, 500);
  }
}

// 2. Get Pending Signups
export async function getPendingSignups(c: Context) {
  try {
    const pendingUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        status: users.status,
        planId: users.planId,
        billingCycle: users.billingCycle,
        trxId: users.trxId,
        paidAmount: users.paidAmount,
        advanceBalance: users.advanceBalance,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.status, "pending"))
      .orderBy(desc(users.createdAt));

    const [paymentConfig] = await db.select().from(paymentSettings).limit(1);
    const chargePercent = paymentConfig?.bkashCharge ?? 1.8;

    const enriched = await Promise.all(
      pendingUsers.map(async (u) => {
        let plan = null;
        if (u.planId) {
          const [foundPlan] = await db.select().from(plans).where(eq(plans.id, u.planId));
          plan = foundPlan;
        }

        const isYearly = u.billingCycle === "yearly" || (u.trxId
          ? (u.trxId.toLowerCase().includes("yearly") || u.trxId.toLowerCase().includes("(y)"))
          : false);
        const planPrice = isYearly ? (plan?.rateYearly || 15000) : (plan?.rateMonthly || 1500);
        const grossAmount = u.paidAmount || planPrice;
        const gatewayCharge = Math.round((grossAmount * chargePercent) / 100);
        const netAmount = grossAmount - gatewayCharge;
        const willActivate = netAmount >= planPrice;
        const shortage = willActivate ? 0 : (planPrice - netAmount);
        const excessCredit = willActivate ? (netAmount - planPrice) : 0;

        return {
          ...u,
          planName: plan?.name || "Standard Plan",
          rateMonthly: plan?.rateMonthly || 1500,
          rateYearly: plan?.rateYearly || 15000,
          planPrice,
          grossAmount,
          chargePercent,
          gatewayCharge,
          netAmount,
          willActivate,
          shortage,
          excessCredit,
          requiredFee: planPrice
        };
      })
    );

    return c.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error("Error fetching pending signups:", error);
    return c.json({ success: false, error: "Failed to fetch pending signups" }, 500);
  }
}

// 3. Approve Signup (Credit Wallet Net Balance & Auto-Activate Plan if Sufficient)
export async function approveSignup(c: Context) {
  try {
    let body: any = {};
    try {
      body = (c.req as any).valid ? (c.req as any).valid("json") : await c.req.json();
    } catch {
      body = await c.req.json().catch(() => ({}));
    }
    const userId = Number(body?.userId);
    const rawDays = body?.days ? Number(body.days) : undefined;
    const days = rawDays && !isNaN(rawDays) && rawDays > 0 ? rawDays : undefined;

    if (!userId || isNaN(userId)) return c.json({ success: false, message: "Valid User ID is required", error: "Valid User ID is required" }, 400);

    const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!targetUser) return c.json({ success: false, message: "Tenant not found", error: "Tenant not found" }, 404);

    let plan = null;
    if (targetUser.planId) {
      const [foundPlan] = await db.select().from(plans).where(eq(plans.id, targetUser.planId));
      plan = foundPlan;
    }

    const [paymentConfig] = await db.select().from(paymentSettings).limit(1);
    const chargePercent = paymentConfig?.bkashCharge ?? 1.8;
    const isYearly = targetUser.billingCycle === "yearly" || (targetUser.trxId
      ? (targetUser.trxId.toLowerCase().includes("yearly") || targetUser.trxId.toLowerCase().includes("(y)"))
      : false);
    const planPrice = isYearly ? (plan?.rateYearly || 15000) : (plan?.rateMonthly || 1500);

    const grossPaid = targetUser.paidAmount || 0;
    const gatewayCharge = Math.round((grossPaid * chargePercent) / 100);
    const netDeposit = grossPaid - gatewayCharge;
    const totalWallet = (targetUser.advanceBalance || 0) + netDeposit;

    let newExpDate: Date | null = null;
    let finalAdvanceBalance = totalWallet;
    let isPlanActivated = false;

    // If total wallet balance covers the plan price, activate and deduct plan fee
    if (totalWallet >= planPrice) {
      finalAdvanceBalance = totalWallet - planPrice;
      isPlanActivated = true;
      newExpDate = new Date();
      if (days && days > 0) {
        newExpDate.setDate(newExpDate.getDate() + Number(days));
      } else {
        if (isYearly) {
          newExpDate.setFullYear(newExpDate.getFullYear() + 1);
        } else {
          newExpDate.setMonth(newExpDate.getMonth() + 1);
        }
      }
    }

    const adminRole = await db.query.roles.findFirst({
      where: eq(roles.name, "admin")
    });

    await db
      .update(users)
      .set({
        status: "active",
        roleId: targetUser.roleId || adminRole?.id || 1,
        expDate: newExpDate,
        advanceBalance: finalAdvanceBalance,
        adminId: userId, // Firm owner is self-admin
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    const cleanTrxId = targetUser.trxId
      ? targetUser.trxId.replace(/\s*\((monthly|yearly|m|y)\)/gi, "").trim()
      : null;

    // 1. Update/Complete Deposit Transaction
    try {
      await db
        .update(subscriptionTransactions)
        .set({
          status: "completed",
          grossAmount: grossPaid,
          gatewayCharge,
          netAmount: netDeposit,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(subscriptionTransactions.userId, userId),
            eq(subscriptionTransactions.status, "pending"),
            eq(subscriptionTransactions.type, "deposit")
          )
        );
    } catch (txErr) {
      console.error("Failed to update pending deposit transaction:", txErr);
    }

    // 2. If plan was activated, insert plan fee deduction transaction
    if (isPlanActivated) {
      try {
        const addedDays = days && days > 0 ? Number(days) : (isYearly ? 365 : 30);
        await db.insert(subscriptionTransactions).values({
          userId,
          planId: targetUser.planId || null,
          type: "plan_fee",
          billingCycle: isYearly ? "yearly" : "monthly",
          grossAmount: planPrice,
          gatewayCharge: 0,
          netAmount: -planPrice,
          planRate: planPrice,
          paidAmount: planPrice,
          excessCredit: finalAdvanceBalance,
          trxId: cleanTrxId,
          paymentMethod: "bkash",
          daysAdded: addedDays,
          status: "completed",
          note: `Plan activated (${isYearly ? "Yearly" : "Monthly"} cycle)`
        });
      } catch (txDeductErr) {
        console.error("Failed to log plan fee deduction transaction:", txDeductErr);
      }
    }

    return c.json({
      success: true,
      message: isPlanActivated
        ? "Tenant approved and subscription activated successfully"
        : "Deposit approved. Tenant account is active, awaiting additional recharge to cover plan price.",
      expDate: newExpDate,
      advanceBalance: finalAdvanceBalance,
      isPlanActivated
    });
  } catch (error: any) {
    console.error("Error approving tenant:", error);
    return c.json({ success: false, error: "Failed to approve tenant" }, 500);
  }
}

// 4. Reject Signup (Delete record)
export async function rejectSignup(c: Context) {
  try {
    const { userId } = await c.req.json();
    if (!userId) return c.json({ success: false, error: "User ID is required" }, 400);

    await db.delete(users).where(eq(users.id, userId));
    return c.json({ success: true, message: "Pending registration rejected and removed" });
  } catch (error: any) {
    console.error("Error rejecting tenant:", error);
    return c.json({ success: false, error: "Failed to reject tenant" }, 500);
  }
}

// 5. Extend Tenant Subscription
export async function extendTenant(c: Context) {
  try {
    const id = parseInt(c.req.param("id"));
    const { days } = await c.req.json();

    if (isNaN(id) || !days || days < 1) {
      return c.json({ success: false, error: "Valid ID and days are required" }, 400);
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, id));
    if (!targetUser) return c.json({ success: false, error: "Tenant not found" }, 404);

    let currentExp = targetUser.expDate ? new Date(targetUser.expDate) : new Date();
    if (currentExp < new Date()) currentExp = new Date();

    currentExp.setDate(currentExp.getDate() + Number(days));

    await db
      .update(users)
      .set({ expDate: currentExp, status: "active", updatedAt: new Date() })
      .where(eq(users.id, id));

    // Record manual subscription extension in history ledger
    try {
      await db.insert(subscriptionTransactions).values({
        userId: id,
        planId: targetUser.planId || null,
        billingCycle: "custom",
        planRate: 0,
        paidAmount: 0,
        excessCredit: 0,
        trxId: null,
        paymentMethod: "admin_manual",
        daysAdded: Number(days),
        status: "completed",
        note: `Subscription extended by ${days} days by SuperAdmin`
      });
    } catch (txErr) {
      console.error("Failed to log subscription transaction:", txErr);
    }

    return c.json({ success: true, message: `Subscription extended by ${days} days`, expDate: currentExp });
  } catch (error: any) {
    console.error("Error extending tenant:", error);
    return c.json({ success: false, error: "Failed to extend subscription" }, 500);
  }
}

// 5.1 Get Tenant Transaction / Payment History
export async function getTenantTransactions(c: Context) {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ success: false, error: "Valid ID is required" }, 400);

    const [tenant] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        status: users.status,
        planId: users.planId,
        trxId: users.trxId,
        paidAmount: users.paidAmount,
        advanceBalance: users.advanceBalance,
        expDate: users.expDate,
        createdAt: users.createdAt,
        roleName: roles.name
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, id));

    if (!tenant) return c.json({ success: false, error: "Tenant not found" }, 404);

    let plan = null;
    if (tenant.planId) {
      const [foundPlan] = await db.select().from(plans).where(eq(plans.id, tenant.planId));
      plan = foundPlan;
    }

    const history = await db
      .select({
        id: subscriptionTransactions.id,
        userId: subscriptionTransactions.userId,
        planId: subscriptionTransactions.planId,
        planName: plans.name,
        billingCycle: subscriptionTransactions.billingCycle,
        planRate: subscriptionTransactions.planRate,
        paidAmount: subscriptionTransactions.paidAmount,
        excessCredit: subscriptionTransactions.excessCredit,
        trxId: subscriptionTransactions.trxId,
        paymentMethod: subscriptionTransactions.paymentMethod,
        daysAdded: subscriptionTransactions.daysAdded,
        status: subscriptionTransactions.status,
        note: subscriptionTransactions.note,
        createdAt: subscriptionTransactions.createdAt
      })
      .from(subscriptionTransactions)
      .leftJoin(plans, eq(subscriptionTransactions.planId, plans.id))
      .where(eq(subscriptionTransactions.userId, id))
      .orderBy(desc(subscriptionTransactions.createdAt));

    return c.json({
      success: true,
      data: {
        tenant: {
          ...tenant,
          planName: plan?.name || "Standard Firm Plan",
          planMaxUsers: plan?.maxUsers || 5,
          planMaxClients: plan?.maxClients || 50,
          planMaxStorageMB: plan?.maxStorageMB || 1024,
          planHasAccounts: plan?.hasAccounts ?? false
        },
        transactions: history
      }
    });
  } catch (error: any) {
    console.error("Error fetching tenant transactions:", error);
    return c.json({ success: false, error: "Failed to fetch transaction history" }, 500);
  }
}

// 6. Toggle Tenant Status (Active / Suspended)
export async function toggleTenantStatus(c: Context) {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ success: false, error: "Valid ID is required" }, 400);

    const [targetUser] = await db
      .select({
        id: users.id,
        status: users.status,
        roleName: roles.name
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, id));

    if (!targetUser) return c.json({ success: false, error: "Tenant not found" }, 404);
    if (targetUser.roleName === "superadmin") {
      return c.json({ success: false, error: "SuperAdmin status cannot be modified" }, 403);
    }

    const nextStatus = targetUser.status === "active" ? "suspended" : "active";

    await db.update(users).set({ status: nextStatus, updatedAt: new Date() }).where(eq(users.id, id));
    return c.json({ success: true, status: nextStatus, message: `Tenant status set to ${nextStatus}` });
  } catch (error: any) {
    console.error("Error toggling tenant status:", error);
    return c.json({ success: false, error: "Failed to toggle status" }, 500);
  }
}

// 7. Delete Tenant Permanently
export async function deleteTenant(c: Context) {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ success: false, error: "Valid ID is required" }, 400);

    const [targetUser] = await db
      .select({
        id: users.id,
        name: users.name,
        roleName: roles.name
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, id));

    if (!targetUser) return c.json({ success: false, error: "Tenant not found" }, 404);
    if (targetUser.roleName === "superadmin") {
      return c.json({ success: false, error: "Cannot delete SuperAdmin account" }, 403);
    }

    await db.delete(users).where(eq(users.id, id));
    return c.json({ success: true, message: `Tenant "${targetUser.name}" deleted permanently` });
  } catch (error: any) {
    console.error("Error deleting tenant:", error);
    return c.json({ success: false, error: "Failed to delete tenant. Please ensure associated client records are unassigned or handled first." }, 500);
  }
}

// 7. Plans CRUD
export async function getPlans(c: Context) {
  try {
    const allPlans = await db.select().from(plans).orderBy(plans.id);
    return c.json({ success: true, data: allPlans });
  } catch (error: any) {
    console.error("Error fetching plans:", error);
    return c.json({ success: false, error: "Failed to fetch plans" }, 500);
  }
}

export async function createPlan(c: Context) {
  try {
    const body = await c.req.json();
    const [newPlan] = await db.insert(plans).values({
      name: body.name,
      rateMonthly: Number(body.rateMonthly),
      rateYearly: Number(body.rateYearly),
      maxUsers: Number(body.maxUsers || 1),
      maxClients: Number(body.maxClients || 50),
      maxStorageMB: Number(body.maxStorageMB || 1024),
      hasAccounts: Boolean(body.hasAccounts),
      yearlyDiscountPercent: Number(body.yearlyDiscountPercent || 0),
      features: body.features || [],
      status: body.status || "active"
    }).returning();

    notifySettingsUpdated("plans");
    return c.json({ success: true, message: "Plan created successfully", data: newPlan });
  } catch (error: any) {
    console.error("Error creating plan:", error);
    return c.json({ success: false, error: "Failed to create plan" }, 500);
  }
}

export async function updatePlan(c: Context) {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ success: false, error: "Invalid plan ID" }, 400);

    const body = await c.req.json();
    const [updatedPlan] = await db.update(plans).set({
      name: body.name,
      rateMonthly: Number(body.rateMonthly),
      rateYearly: Number(body.rateYearly),
      maxUsers: Number(body.maxUsers || 1),
      maxClients: Number(body.maxClients || 50),
      maxStorageMB: Number(body.maxStorageMB || 1024),
      hasAccounts: Boolean(body.hasAccounts),
      yearlyDiscountPercent: Number(body.yearlyDiscountPercent || 0),
      features: body.features || [],
      status: body.status || "active",
      updatedAt: new Date()
    }).where(eq(plans.id, id)).returning();

    notifySettingsUpdated("plans");
    return c.json({ success: true, message: "Plan updated successfully", data: updatedPlan });
  } catch (error: any) {
    console.error("Error updating plan:", error);
    return c.json({ success: false, error: "Failed to update plan" }, 500);
  }
}

export async function deletePlan(c: Context) {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ success: false, error: "Invalid plan ID" }, 400);

    await db.delete(plans).where(eq(plans.id, id));
    notifySettingsUpdated("plans");
    return c.json({ success: true, message: "Plan deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting plan:", error);
    return c.json({ success: false, error: "Failed to delete plan" }, 500);
  }
}

// 8. Payment Settings (bKash Gateway)
export async function getPaymentSettings(c: Context) {
  try {
    let [config] = await db.select().from(paymentSettings).limit(1);
    if (!config) {
      [config] = await db.insert(paymentSettings).values({
        bkashNumber: "01719950891",
        bkashCharge: 1.8
      }).returning();
    }
    return c.json({ success: true, data: config });
  } catch (error: any) {
    console.error("Error fetching payment settings:", error);
    return c.json({ success: false, error: "Failed to fetch payment settings" }, 500);
  }
}

export async function savePaymentSettings(c: Context) {
  try {
    const body = await c.req.json();
    let [existing] = await db.select().from(paymentSettings).limit(1);

    if (existing) {
      const [updated] = await db.update(paymentSettings).set({
        bkashNumber: body.bkashNumber,
        bkashCharge: Number(body.bkashCharge || 1.8),
        nagadNumber: body.nagadNumber,
        rocketNumber: body.rocketNumber,
        updatedAt: new Date()
      }).where(eq(paymentSettings.id, existing.id)).returning();
      notifySettingsUpdated("payment-settings");
      return c.json({ success: true, message: "Payment settings updated", data: updated });
    } else {
      const [created] = await db.insert(paymentSettings).values({
        bkashNumber: body.bkashNumber,
        bkashCharge: Number(body.bkashCharge || 1.8),
        nagadNumber: body.nagadNumber,
        rocketNumber: body.rocketNumber
      }).returning();
      notifySettingsUpdated("payment-settings");
      return c.json({ success: true, message: "Payment settings saved", data: created });
    }
  } catch (error: any) {
    console.error("Error saving payment settings:", error);
    return c.json({ success: false, error: "Failed to save payment settings" }, 500);
  }
}

// 9. Storage Stats & Tenant-wise Usage Ranking
export async function getStorageStats(c: Context) {
  try {
    let dbSizeMB = 0;
    let tablesCount = 0;

    try {
      const dbResult = await db.execute(sql`
        SELECT ROUND(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))) / 1024.0 / 1024.0, 2) as sizeMB,
               COUNT(tablename) as tables_count
        FROM pg_tables 
        WHERE schemaname = 'public'
      `);
      const rows = Array.isArray(dbResult) ? dbResult : (dbResult as any).rows;
      if (rows && rows.length > 0) {
        dbSizeMB = Number(rows[0].sizemb || rows[0].sizeMB || 0);
        tablesCount = Number(rows[0].tables_count || 0);
      }
    } catch { }

    const [clientsTotal] = await db.select({ count: sql<number>`count(*)` }).from(clients);
    const [usersTotal] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [submissionsTotal] = await db.select({ count: sql<number>`count(*)` }).from(vatSubmissions);
    const [billsTotal] = await db.select({ count: sql<number>`count(*)` }).from(bills);

    const totalClients = Number(clientsTotal?.count || 0);
    const totalUsers = Number(usersTotal?.count || 0);
    const totalSubmissions = Number(submissionsTotal?.count || 0);
    const totalBills = Number(billsTotal?.count || 0);
    const totalRowsCount = totalClients + totalUsers + totalSubmissions + totalBills;

    // Fetch non-superadmin tenants
    const superadminRole = await db.query.roles.findFirst({
      where: eq(roles.name, "superadmin")
    });
    const superadminRoleId = superadminRole?.id ?? -1;

    const tenantsList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        status: users.status,
        planId: users.planId,
        createdAt: users.createdAt
      })
      .from(users)
      .where(and(ne(users.status, "pending"), ne(users.roleId, superadminRoleId)))
      .orderBy(desc(users.createdAt));

    let grandTotalTenantRecords = 0;

    const tenantStatsRaw = await Promise.all(
      tenantsList.map(async (t) => {
        // Count clients created by or associated with tenant
        const [clientCountRes] = await db
          .select({ count: sql<number>`count(*)` })
          .from(clients)
          .where(eq(clients.createdBy, t.id));

        const cCount = Number(clientCountRes?.count || 0);

        // Count submissions submitted by tenant
        const [submissionCountRes] = await db
          .select({ count: sql<number>`count(*)` })
          .from(vatSubmissions)
          .where(eq(vatSubmissions.submittedBy, t.id));

        const sCount = Number(submissionCountRes?.count || 0);

        // Count bills created by tenant
        const [billCountRes] = await db
          .select({ count: sql<number>`count(*)` })
          .from(bills)
          .where(eq(bills.createdBy, t.id));

        const bCount = Number(billCountRes?.count || 0);

        // Fallback for demo/primary firm tenant if not explicitly assigned
        const effectiveClients = cCount > 0 ? cCount : (t.id === 4 ? totalClients : 0);
        const effectiveSubmissions = sCount > 0 ? sCount : (t.id === 4 ? totalSubmissions : 0);
        const effectiveBills = bCount > 0 ? bCount : (t.id === 4 ? totalBills : 0);

        // Calculate total business records
        const totalRecords = effectiveClients + effectiveSubmissions + effectiveBills;
        grandTotalTenantRecords += totalRecords;

        return {
          id: t.id,
          name: t.name,
          email: t.email,
          mobile: t.mobile,
          status: t.status,
          planId: t.planId,
          createdAt: t.createdAt,
          clientsCount: effectiveClients,
          submissionsCount: effectiveSubmissions,
          billsCount: effectiveBills,
          totalRecords
        };
      })
    );

    // Sort by Total Records Descending (Rank #1 at top)
    const sortedTenants = [...tenantStatsRaw].sort((a, b) => b.totalRecords - a.totalRecords);

    // Assign Rank and calculate storage footprint
    const tenantBreakdown = sortedTenants.map((t, index) => {
      const sharePercent = grandTotalTenantRecords > 0
        ? Math.round((t.totalRecords / grandTotalTenantRecords) * 100)
        : 0;

      // Estimated data footprint in KB / MB
      const estimatedKB = Math.round(t.totalRecords * 3.2); // ~3.2 KB per record with indices and history
      const estimatedMB = Number((estimatedKB / 1024).toFixed(2));

      return {
        ...t,
        rank: index + 1,
        sharePercent,
        estimatedKB,
        estimatedMB
      };
    });

    const now = new Date();
    const lastMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    return c.json({
      success: true,
      data: {
        dbSizeMB: dbSizeMB > 0 ? dbSizeMB : 18.5,
        tablesCount: tablesCount > 0 ? tablesCount : 18,
        totalRows: totalRowsCount,
        totalClients,
        totalUsers,
        totalSubmissions,
        totalBills,
        tenantsCount: tenantsList.length,
        rankingResetTime: "12:00 AM Daily",
        lastCalculated: lastMidnight.toISOString(),
        tenantBreakdown
      }
    });
  } catch (error: any) {
    console.error("Error fetching storage stats:", error);
    return c.json({ success: false, error: "Failed to fetch storage stats" }, 500);
  }
}

// 7. Client Types CRUD (Operating on master customer_types table)
export async function getClientTypes(c: Context) {
  try {
    const list = await db.select().from(customerTypes).orderBy(desc(customerTypes.id));
    return c.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching client types:", error);
    return c.json({ success: false, error: "Failed to fetch client types" }, 500);
  }
}

export async function createClientType(c: Context) {
  try {
    const body = await c.req.json();
    const name = body.typeName || body.name;
    if (!name || !name.trim()) {
      return c.json({ success: false, error: "Name is required" }, 400);
    }
    const [created] = await db
      .insert(customerTypes)
      .values({
        typeName: name.trim(),
        description: body.description?.trim() || null,
        isActive: body.isActive ?? true
      })
      .returning();

    notifySettingsUpdated("client-types");
    return c.json({ success: true, data: created, message: "Client type created successfully" }, 201);
  } catch (error: any) {
    console.error("Error creating client type:", error);
    return c.json({ success: false, error: "Failed to create client type" }, 500);
  }
}

export async function updateClientType(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const name = body.typeName || body.name;
    if (!name || !name.trim()) {
      return c.json({ success: false, error: "Name is required" }, 400);
    }
    const [updated] = await db
      .update(customerTypes)
      .set({
        typeName: name.trim(),
        description: body.description?.trim() || null,
        isActive: body.isActive ?? true,
        updatedAt: new Date()
      })
      .where(eq(customerTypes.id, id))
      .returning();

    notifySettingsUpdated("client-types");
    return c.json({ success: true, data: updated, message: "Client type updated successfully" });
  } catch (error: any) {
    console.error("Error updating client type:", error);
    return c.json({ success: false, error: "Failed to update client type" }, 500);
  }
}

export async function toggleClientTypeStatus(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const [found] = await db.select().from(customerTypes).where(eq(customerTypes.id, id));
    if (!found) {
      return c.json({ success: false, error: "Client type not found" }, 404);
    }
    const [updated] = await db
      .update(customerTypes)
      .set({
        isActive: !found.isActive,
        updatedAt: new Date()
      })
      .where(eq(customerTypes.id, id))
      .returning();

    notifySettingsUpdated("client-types");
    return c.json({ success: true, data: updated, message: "Status updated" });
  } catch (error: any) {
    console.error("Error toggling client type status:", error);
    return c.json({ success: false, error: "Failed to toggle status" }, 500);
  }
}

export async function deleteClientType(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    await db.delete(customerTypes).where(eq(customerTypes.id, id));
    notifySettingsUpdated("client-types");
    return c.json({ success: true, message: "Client type deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting client type:", error);
    return c.json({ success: false, error: "Failed to delete client type" }, 500);
  }
}

// 8. Locations & Districts CRUD
export async function getLocations(c: Context) {
  try {
    const locs = await db.select().from(locations).orderBy(desc(locations.id));
    const allAreas = await db.select().from(commercialAreas);

    const enriched = locs.map((l) => ({
      ...l,
      areasCount: allAreas.filter((a) => a.locationId === l.id).length
    }));

    return c.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error("Error fetching locations:", error);
    return c.json({ success: false, error: "Failed to fetch locations" }, 500);
  }
}

export async function createLocation(c: Context) {
  try {
    const body = await c.req.json();
    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: "Location name is required" }, 400);
    }
    const [created] = await db
      .insert(locations)
      .values({
        name: body.name.trim(),
        code: body.code?.trim()?.toUpperCase() || null,
        isActive: body.isActive ?? true
      })
      .returning();

    notifySettingsUpdated("locations");
    return c.json({ success: true, data: created, message: "Location created successfully" }, 201);
  } catch (error: any) {
    console.error("Error creating location:", error);
    return c.json({ success: false, error: error.message || "Failed to create location" }, 500);
  }
}

export async function updateLocation(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: "Location name is required" }, 400);
    }
    const [updated] = await db
      .update(locations)
      .set({
        name: body.name.trim(),
        code: body.code?.trim()?.toUpperCase() || null,
        isActive: body.isActive ?? true,
        updatedAt: new Date()
      })
      .where(eq(locations.id, id))
      .returning();

    notifySettingsUpdated("locations");
    return c.json({ success: true, data: updated, message: "Location updated successfully" });
  } catch (error: any) {
    console.error("Error updating location:", error);
    return c.json({ success: false, error: error.message || "Failed to update location" }, 500);
  }
}

export async function toggleLocationStatus(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const [found] = await db.select().from(locations).where(eq(locations.id, id));
    if (!found) return c.json({ success: false, error: "Location not found" }, 404);

    const [updated] = await db
      .update(locations)
      .set({ isActive: !found.isActive, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();

    notifySettingsUpdated("locations");
    return c.json({ success: true, data: updated, message: "Status updated" });
  } catch (error: any) {
    console.error("Error toggling location status:", error);
    return c.json({ success: false, error: "Failed to toggle status" }, 500);
  }
}

export async function deleteLocation(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    await db.delete(locations).where(eq(locations.id, id));
    notifySettingsUpdated("locations");
    return c.json({ success: true, message: "Location deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting location:", error);
    return c.json({ success: false, error: "Failed to delete location" }, 500);
  }
}

// 9. Commercial Areas CRUD
export async function getCommercialAreas(c: Context) {
  try {
    const areaList = await db
      .select({
        id: commercialAreas.id,
        locationId: commercialAreas.locationId,
        name: commercialAreas.name,
        postalCode: commercialAreas.postalCode,
        isActive: commercialAreas.isActive,
        createdAt: commercialAreas.createdAt,
        updatedAt: commercialAreas.updatedAt,
        locationName: locations.name
      })
      .from(commercialAreas)
      .leftJoin(locations, eq(commercialAreas.locationId, locations.id))
      .orderBy(desc(commercialAreas.id));

    return c.json({ success: true, data: areaList });
  } catch (error: any) {
    console.error("Error fetching commercial areas:", error);
    return c.json({ success: false, error: "Failed to fetch areas" }, 500);
  }
}

export async function createCommercialArea(c: Context) {
  try {
    const body = await c.req.json();
    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: "Area name is required" }, 400);
    }
    if (!body.locationId) {
      return c.json({ success: false, error: "Parent location is required" }, 400);
    }

    const [created] = await db
      .insert(commercialAreas)
      .values({
        locationId: Number(body.locationId),
        name: body.name.trim(),
        postalCode: body.postalCode?.trim() || null,
        isActive: body.isActive ?? true
      })
      .returning();

    const [loc] = await db.select().from(locations).where(eq(locations.id, created.locationId));

    notifySettingsUpdated("commercial-areas");
    return c.json({
      success: true,
      data: { ...created, locationName: loc?.name || "—" },
      message: "Commercial area created successfully"
    }, 201);
  } catch (error: any) {
    console.error("Error creating commercial area:", error);
    return c.json({ success: false, error: error.message || "Failed to create area" }, 500);
  }
}

export async function updateCommercialArea(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: "Area name is required" }, 400);
    }
    const [updated] = await db
      .update(commercialAreas)
      .set({
        locationId: Number(body.locationId),
        name: body.name.trim(),
        postalCode: body.postalCode?.trim() || null,
        isActive: body.isActive ?? true,
        updatedAt: new Date()
      })
      .where(eq(commercialAreas.id, id))
      .returning();

    const [loc] = await db.select().from(locations).where(eq(locations.id, updated.locationId));

    notifySettingsUpdated("commercial-areas");
    return c.json({
      success: true,
      data: { ...updated, locationName: loc?.name || "—" },
      message: "Commercial area updated successfully"
    });
  } catch (error: any) {
    console.error("Error updating commercial area:", error);
    return c.json({ success: false, error: error.message || "Failed to update area" }, 500);
  }
}

export async function toggleCommercialAreaStatus(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const [found] = await db.select().from(commercialAreas).where(eq(commercialAreas.id, id));
    if (!found) return c.json({ success: false, error: "Area not found" }, 404);

    const [updated] = await db
      .update(commercialAreas)
      .set({ isActive: !found.isActive, updatedAt: new Date() })
      .where(eq(commercialAreas.id, id))
      .returning();

    notifySettingsUpdated("commercial-areas");
    return c.json({ success: true, data: updated, message: "Status updated" });
  } catch (error: any) {
    console.error("Error toggling area status:", error);
    return c.json({ success: false, error: "Failed to toggle status" }, 500);
  }
}

export async function deleteCommercialArea(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    await db.delete(commercialAreas).where(eq(commercialAreas.id, id));
    notifySettingsUpdated("commercial-areas");
    return c.json({ success: true, message: "Commercial area deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting commercial area:", error);
    return c.json({ success: false, error: "Failed to delete commercial area" }, 500);
  }
}

// 10. Client References CRUD (Operating on master client_references table)
export async function getClientReferences(c: Context) {
  try {
    const refs = await db.select().from(clientReferences).orderBy(desc(clientReferences.id));
    const allClients = await db.select({ referenceId: clients.referenceId }).from(clients);

    const enriched = refs.map((r) => ({
      ...r,
      referredClientsCount: allClients.filter((cl) => cl.referenceId === r.id).length
    }));

    return c.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error("Error fetching client references:", error);
    return c.json({ success: false, error: "Failed to fetch references" }, 500);
  }
}

export async function createClientReference(c: Context) {
  try {
    const body = await c.req.json();
    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: "Reference name is required" }, 400);
    }
    const [created] = await db
      .insert(clientReferences)
      .values({
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        notes: body.notes?.trim() || null,
        isActive: body.isActive ?? true
      })
      .returning();

    notifySettingsUpdated("references");
    return c.json({ success: true, data: created, message: "Reference created successfully" }, 201);
  } catch (error: any) {
    console.error("Error creating reference:", error);
    return c.json({ success: false, error: error.message || "Failed to create reference" }, 500);
  }
}

export async function updateClientReference(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: "Reference name is required" }, 400);
    }
    const [updated] = await db
      .update(clientReferences)
      .set({
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        notes: body.notes?.trim() || null,
        isActive: body.isActive ?? true,
        updatedAt: new Date()
      })
      .where(eq(clientReferences.id, id))
      .returning();

    notifySettingsUpdated("references");
    return c.json({ success: true, data: updated, message: "Reference updated successfully" });
  } catch (error: any) {
    console.error("Error updating reference:", error);
    return c.json({ success: false, error: error.message || "Failed to update reference" }, 500);
  }
}

export async function toggleClientReferenceStatus(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const [found] = await db.select().from(clientReferences).where(eq(clientReferences.id, id));
    if (!found) return c.json({ success: false, error: "Reference not found" }, 404);

    const [updated] = await db
      .update(clientReferences)
      .set({ isActive: !found.isActive, updatedAt: new Date() })
      .where(eq(clientReferences.id, id))
      .returning();

    notifySettingsUpdated("references");
    return c.json({ success: true, data: updated, message: "Status updated" });
  } catch (error: any) {
    console.error("Error toggling reference status:", error);
    return c.json({ success: false, error: "Failed to toggle status" }, 500);
  }
}

export async function deleteClientReference(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    await db.delete(clientReferences).where(eq(clientReferences.id, id));
    notifySettingsUpdated("references");
    return c.json({ success: true, message: "Reference deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting reference:", error);
    return c.json({ success: false, error: "Failed to delete reference" }, 500);
  }
}

// 11. Column Mappings (Operating on master column_mappings table)
export async function getColumnMappings(c: Context) {
  try {
    const list = await db.select().from(columnMappings).orderBy(asc(columnMappings.id));
    return c.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching column mappings:", error);
    return c.json({ success: false, error: "Failed to fetch column mappings" }, 500);
  }
}

export async function saveColumnMappings(c: Context) {
  try {
    const { rows } = await c.req.json();
    if (!Array.isArray(rows)) {
      return c.json({ success: false, error: "Mappings array is required" }, 400);
    }

    for (const row of rows) {
      if (row.dbColumn) {
        await db
          .insert(columnMappings)
          .values({
            dbColumn: row.dbColumn,
            label: row.label || row.dbColumn,
            excelHeader: row.excelHeader || null,
            isCalculated: row.isCalculated ?? false,
            isFromDb: row.isFromDb ?? false,
            isRegexExtracted: row.isRegexExtracted ?? false,
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: columnMappings.dbColumn,
            set: {
              excelHeader: row.excelHeader || null,
              label: row.label || row.dbColumn,
              isCalculated: row.isCalculated ?? false,
              isFromDb: row.isFromDb ?? false,
              isRegexExtracted: row.isRegexExtracted ?? false,
              updatedAt: new Date()
            }
          });
      }
    }

    const updatedList = await db.select().from(columnMappings).orderBy(asc(columnMappings.id));
    notifySettingsUpdated("column-mappings");
    return c.json({ success: true, data: updatedList, message: "Column mappings saved to database successfully" });
  } catch (error: any) {
    console.error("Error saving column mappings:", error);
    return c.json({ success: false, error: error.message || "Failed to save column mappings" }, 500);
  }
}

// 12. Global Commodity & HS Codes (Operating on global_items table)
export async function getGlobalItems(c: Context) {
  try {
    const list = await db.select().from(globalItems).orderBy(asc(globalItems.hsCode));
    return c.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching global items:", error);
    return c.json({ success: false, error: "Failed to fetch global items" }, 500);
  }
}

export async function createGlobalItem(c: Context) {
  try {
    const body = await c.req.json();
    const { hsCode, awHsCode, name, unit, isActive } = body;

    if (!hsCode || !name) {
      return c.json({ success: false, error: "HS Code and Name are required" }, 400);
    }

    const trimmedHsCode = hsCode.trim();

    // Check duplicate HS Code
    const [existing] = await db
      .select()
      .from(globalItems)
      .where(sql`LOWER(TRIM(${globalItems.hsCode})) = LOWER(${trimmedHsCode})`);

    if (existing) {
      return c.json({
        success: false,
        error: `HS Code "${trimmedHsCode}" already exists in the catalog. Duplicate HS Codes are not allowed.`
      }, 400);
    }

    const calculatedAw = awHsCode ? awHsCode.trim() : trimmedHsCode.replace(/\./g, "").trim();

    const [inserted] = await db
      .insert(globalItems)
      .values({
        hsCode: trimmedHsCode,
        awHsCode: calculatedAw,
        name: name.trim(),
        unit: unit?.trim() || "U",
        isActive: isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    notifySettingsUpdated("global-items");
    return c.json({ success: true, data: inserted, message: "Item added successfully" }, 201);
  } catch (error: any) {
    console.error("Error creating global item:", error);
    if (error?.code === "23505") {
      return c.json({ success: false, error: "This HS Code already exists in the database." }, 400);
    }
    return c.json({ success: false, error: error.message || "Failed to create global item" }, 500);
  }
}

export async function updateGlobalItem(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const { hsCode, awHsCode, name, unit, isActive } = body;

    const [found] = await db.select().from(globalItems).where(eq(globalItems.id, id));
    if (!found) return c.json({ success: false, error: "Item not found" }, 404);

    if (hsCode) {
      const trimmedHsCode = hsCode.trim();
      const [existing] = await db
        .select()
        .from(globalItems)
        .where(
          and(
            sql`LOWER(TRIM(${globalItems.hsCode})) = LOWER(${trimmedHsCode})`,
            ne(globalItems.id, id)
          )
        );

      if (existing) {
        return c.json({
          success: false,
          error: `HS Code "${trimmedHsCode}" is already in use by another item.`
        }, 400);
      }
    }

    const calculatedAw = awHsCode !== undefined ? (awHsCode?.trim() || "") : hsCode ? hsCode.replace(/\./g, "").trim() : found.awHsCode;

    const [updated] = await db
      .update(globalItems)
      .set({
        ...(hsCode && { hsCode: hsCode.trim() }),
        ...(calculatedAw !== undefined && { awHsCode: calculatedAw }),
        ...(name && { name: name.trim() }),
        ...(unit !== undefined && { unit: unit?.trim() || "U" }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date()
      })
      .where(eq(globalItems.id, id))
      .returning();

    notifySettingsUpdated("global-items");
    return c.json({ success: true, data: updated, message: "Item updated successfully" });
  } catch (error: any) {
    console.error("Error updating global item:", error);
    if (error?.code === "23505") {
      return c.json({ success: false, error: "This HS Code already exists in the database." }, 400);
    }
    return c.json({ success: false, error: error.message || "Failed to update global item" }, 500);
  }
}

export async function toggleGlobalItemStatus(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const [found] = await db.select().from(globalItems).where(eq(globalItems.id, id));
    if (!found) return c.json({ success: false, error: "Item not found" }, 404);

    const [updated] = await db
      .update(globalItems)
      .set({ isActive: !found.isActive, updatedAt: new Date() })
      .where(eq(globalItems.id, id))
      .returning();

    notifySettingsUpdated("global-items");
    return c.json({ success: true, data: updated, message: "Status updated" });
  } catch (error: any) {
    console.error("Error toggling global item status:", error);
    return c.json({ success: false, error: "Failed to toggle status" }, 500);
  }
}

export async function deleteGlobalItem(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    await db.delete(globalItems).where(eq(globalItems.id, id));
    notifySettingsUpdated("global-items");
    return c.json({ success: true, message: "Item deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting global item:", error);
    return c.json({ success: false, error: "Failed to delete item" }, 500);
  }
}

// 13. Measurement Units (Operating on measurement_units table)
export async function getMeasurementUnits(c: Context) {
  try {
    const list = await db.select().from(measurementUnits).orderBy(asc(measurementUnits.id));
    return c.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching measurement units:", error);
    return c.json({ success: false, error: "Failed to fetch measurement units" }, 500);
  }
}

export async function createMeasurementUnit(c: Context) {
  try {
    const body = await c.req.json();
    const { code, name, description, isActive } = body;

    if (!code || !name) {
      return c.json({ success: false, error: "Unit Code and Name are required" }, 400);
    }

    const trimmedCode = code.trim().toUpperCase();

    // Check duplicate code
    const [existing] = await db
      .select()
      .from(measurementUnits)
      .where(sql`UPPER(TRIM(${measurementUnits.code})) = ${trimmedCode}`);

    if (existing) {
      return c.json({
        success: false,
        error: `Unit Code "${trimmedCode}" already exists in the database.`
      }, 400);
    }

    const [inserted] = await db
      .insert(measurementUnits)
      .values({
        code: trimmedCode,
        name: name.trim(),
        description: description?.trim() || null,
        isActive: isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    notifySettingsUpdated("measurement-units");
    return c.json({ success: true, data: inserted, message: "Unit created successfully" }, 201);
  } catch (error: any) {
    console.error("Error creating measurement unit:", error);
    if (error?.code === "23505") {
      return c.json({ success: false, error: "This Unit Code already exists in the database." }, 400);
    }
    return c.json({ success: false, error: error.message || "Failed to create measurement unit" }, 500);
  }
}

export async function updateMeasurementUnit(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const { code, name, description, isActive } = body;

    const [found] = await db.select().from(measurementUnits).where(eq(measurementUnits.id, id));
    if (!found) return c.json({ success: false, error: "Unit not found" }, 404);

    if (code) {
      const trimmedCode = code.trim().toUpperCase();
      const [existing] = await db
        .select()
        .from(measurementUnits)
        .where(
          and(
            sql`UPPER(TRIM(${measurementUnits.code})) = ${trimmedCode}`,
            ne(measurementUnits.id, id)
          )
        );

      if (existing) {
        return c.json({
          success: false,
          error: `Unit Code "${trimmedCode}" is already in use by another unit.`
        }, 400);
      }
    }

    const [updated] = await db
      .update(measurementUnits)
      .set({
        ...(code && { code: code.trim().toUpperCase() }),
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date()
      })
      .where(eq(measurementUnits.id, id))
      .returning();

    notifySettingsUpdated("measurement-units");
    return c.json({ success: true, data: updated, message: "Unit updated successfully" });
  } catch (error: any) {
    console.error("Error updating measurement unit:", error);
    if (error?.code === "23505") {
      return c.json({ success: false, error: "This Unit Code already exists in the database." }, 400);
    }
    return c.json({ success: false, error: error.message || "Failed to update measurement unit" }, 500);
  }
}

export async function toggleMeasurementUnitStatus(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const [found] = await db.select().from(measurementUnits).where(eq(measurementUnits.id, id));
    if (!found) return c.json({ success: false, error: "Unit not found" }, 404);

    const [updated] = await db
      .update(measurementUnits)
      .set({ isActive: !found.isActive, updatedAt: new Date() })
      .where(eq(measurementUnits.id, id))
      .returning();

    notifySettingsUpdated("measurement-units");
    return c.json({ success: true, data: updated, message: "Unit status updated" });
  } catch (error: any) {
    console.error("Error toggling measurement unit status:", error);
    return c.json({ success: false, error: "Failed to toggle status" }, 500);
  }
}

export async function deleteMeasurementUnit(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    await db.delete(measurementUnits).where(eq(measurementUnits.id, id));
    notifySettingsUpdated("measurement-units");
    return c.json({ success: true, message: "Unit deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting measurement unit:", error);
    return c.json({ success: false, error: "Failed to delete measurement unit" }, 500);
  }
}

// 14. VAT Note Rules / Mappings (Operating on vat_notes_mapping table)
export async function getVatNotes(c: Context) {
  try {
    const list = await db.select().from(vatNotes).orderBy(asc(vatNotes.vatRate));
    return c.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching VAT notes:", error);
    return c.json({ success: false, error: "Failed to fetch VAT notes" }, 500);
  }
}

export async function createVatNote(c: Context) {
  try {
    const body = await c.req.json();
    const { vatRate, noteName, description, isActive } = body;

    if (vatRate === undefined || vatRate === null || !noteName) {
      return c.json({ success: false, error: "VAT Rate (%) and Note Name are required" }, 400);
    }

    const numericRate = parseFloat(vatRate);
    if (isNaN(numericRate)) {
      return c.json({ success: false, error: "Valid numeric VAT rate is required" }, 400);
    }

    const trimmedNote = noteName.trim();

    // Check duplicate vatRate
    const [existing] = await db
      .select()
      .from(vatNotes)
      .where(eq(vatNotes.vatRate, numericRate));

    if (existing) {
      return c.json({
        success: false,
        error: `A mapping for VAT Rate "${numericRate}%" already exists (${existing.noteName}). Duplicate VAT rates are not allowed.`
      }, 400);
    }

    const [inserted] = await db
      .insert(vatNotes)
      .values({
        vatRate: numericRate,
        noteName: trimmedNote,
        description: description ? description.trim() : null,
        isActive: isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    notifySettingsUpdated("vat-notes");
    return c.json({ success: true, data: inserted, message: "VAT Note mapping created successfully" }, 201);
  } catch (error: any) {
    console.error("Error creating VAT note mapping:", error);
    if (error?.code === "23505") {
      return c.json({ success: false, error: "A mapping for this VAT Rate already exists." }, 400);
    }
    return c.json({ success: false, error: error.message || "Failed to create VAT note mapping" }, 500);
  }
}

export async function updateVatNote(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const { vatRate, noteName, description, isActive } = body;

    const [found] = await db.select().from(vatNotes).where(eq(vatNotes.id, id));
    if (!found) return c.json({ success: false, error: "VAT note not found" }, 404);

    let numericRate = found.vatRate;
    if (vatRate !== undefined && vatRate !== null) {
      numericRate = parseFloat(vatRate);
      if (isNaN(numericRate)) {
        return c.json({ success: false, error: "Valid numeric VAT rate is required" }, 400);
      }

      const [existing] = await db
        .select()
        .from(vatNotes)
        .where(and(eq(vatNotes.vatRate, numericRate), ne(vatNotes.id, id)));

      if (existing) {
        return c.json({
          success: false,
          error: `A mapping for VAT Rate "${numericRate}%" is already configured (${existing.noteName}).`
        }, 400);
      }
    }

    const [updated] = await db
      .update(vatNotes)
      .set({
        vatRate: numericRate,
        ...(noteName && { noteName: noteName.trim() }),
        ...(description !== undefined && { description: description ? description.trim() : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        updatedAt: new Date()
      })
      .where(eq(vatNotes.id, id))
      .returning();

    notifySettingsUpdated("vat-notes");
    return c.json({ success: true, data: updated, message: "VAT note updated successfully" });
  } catch (error: any) {
    console.error("Error updating VAT note mapping:", error);
    if (error?.code === "23505") {
      return c.json({ success: false, error: "A mapping for this VAT Rate already exists." }, 400);
    }
    return c.json({ success: false, error: error.message || "Failed to update VAT note mapping" }, 500);
  }
}

export async function toggleVatNoteStatus(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const [found] = await db.select().from(vatNotes).where(eq(vatNotes.id, id));
    if (!found) return c.json({ success: false, error: "VAT note not found" }, 404);

    const [updated] = await db
      .update(vatNotes)
      .set({
        isActive: !found.isActive,
        updatedAt: new Date()
      })
      .where(eq(vatNotes.id, id))
      .returning();

    notifySettingsUpdated("vat-notes");
    return c.json({ success: true, data: updated, message: "VAT note status updated" });
  } catch (error: any) {
    console.error("Error toggling VAT note status:", error);
    return c.json({ success: false, error: "Failed to toggle status" }, 500);
  }
}

export async function deleteVatNote(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    await db.delete(vatNotes).where(eq(vatNotes.id, id));
    notifySettingsUpdated("vat-notes");
    return c.json({ success: true, message: "VAT note deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting VAT note:", error);
    return c.json({ success: false, error: "Failed to delete VAT note" }, 500);
  }
}

// 15. Unit Conversions (Operating on PostgreSQL unit_conversions table)
export async function getUnitConversions(c: Context) {
  try {
    const list = await db.select().from(unitConversions).orderBy(asc(unitConversions.id));
    const allParam = c.req.query("all");
    if (allParam === "true") {
      return c.json({ success: true, data: list });
    }

    // Deduplicate pairs for Settings View (showing canonical pairs with direct & reverse)
    const seen = new Set<string>();
    const uniquePairs: any[] = [];
    for (const item of list) {
      const key = [item.purchaseUnit, item.salesUnit].sort().join("<->");
      if (!seen.has(key)) {
        seen.add(key);
        const f = Number(item.factor || 1);
        const revFactor = f > 0 ? Math.round((1 / f) * 100000000) / 100000000 : 0;
        uniquePairs.push({
          id: item.id,
          purchaseUnit: item.purchaseUnit,
          salesUnit: item.salesUnit,
          factor: f,
          reverseFactor: revFactor,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        });
      }
    }
    return c.json({ success: true, data: uniquePairs });
  } catch (error: any) {
    console.error("Error fetching unit conversions:", error);
    return c.json({ success: false, error: "Failed to fetch unit conversions" }, 500);
  }
}

export async function createUnitConversion(c: Context) {
  try {
    const body = await c.req.json();
    const { purchaseUnit, salesUnit, factor } = body;

    if (!purchaseUnit || !salesUnit || factor === undefined || factor === null) {
      return c.json({ success: false, error: "Purchase unit, Sales unit, and Factor are required" }, 400);
    }

    const pUnit = purchaseUnit.trim().toUpperCase();
    const sUnit = salesUnit.trim().toUpperCase();

    if (pUnit === sUnit) {
      return c.json({
        success: false,
        error: "Purchase Unit and Sales Unit cannot be the same unit (e.g. KG to KG is not allowed). Please select different units."
      }, 400);
    }

    const numFactor = parseFloat(factor);
    if (isNaN(numFactor) || numFactor <= 0) {
      return c.json({ success: false, error: "Factor must be a valid positive number" }, 400);
    }

    // Check duplicate conversion in BOTH directions
    const [existingForward] = await db
      .select()
      .from(unitConversions)
      .where(and(eq(unitConversions.purchaseUnit, pUnit), eq(unitConversions.salesUnit, sUnit)));

    const [existingReverse] = await db
      .select()
      .from(unitConversions)
      .where(and(eq(unitConversions.purchaseUnit, sUnit), eq(unitConversions.salesUnit, pUnit)));

    if (existingForward || existingReverse) {
      return c.json({
        success: false,
        error: `Conversion pair between "${pUnit}" and "${sUnit}" already exists in the database!`
      }, 400);
    }

    const reverseFactor = Math.round((1 / numFactor) * 100000000) / 100000000;

    // Insert forward record
    const [inserted] = await db
      .insert(unitConversions)
      .values({
        purchaseUnit: pUnit,
        salesUnit: sUnit,
        factor: numFactor,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Automatically insert bi-directional reverse record for reporting/lookup
    await db
      .insert(unitConversions)
      .values({
        purchaseUnit: sUnit,
        salesUnit: pUnit,
        factor: reverseFactor,
        createdAt: new Date(),
        updatedAt: new Date()
      });

    notifySettingsUpdated("unit-conversions");
    return c.json({
      success: true,
      data: {
        ...inserted,
        reverseFactor
      },
      message: "Unit conversion pair created successfully"
    }, 201);
  } catch (error: any) {
    console.error("Error creating unit conversion:", error);
    return c.json({ success: false, error: error.message || "Failed to create unit conversion" }, 500);
  }
}

export async function updateUnitConversion(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const { purchaseUnit, salesUnit, factor } = body;

    const [found] = await db.select().from(unitConversions).where(eq(unitConversions.id, id));
    if (!found) return c.json({ success: false, error: "Unit conversion not found" }, 404);

    const oldP = found.purchaseUnit;
    const oldS = found.salesUnit;

    const pUnit = purchaseUnit ? purchaseUnit.trim().toUpperCase() : oldP;
    const sUnit = salesUnit ? salesUnit.trim().toUpperCase() : oldS;

    if (pUnit === sUnit) {
      return c.json({
        success: false,
        error: "Purchase Unit and Sales Unit cannot be the same unit (e.g. KG to KG is not allowed). Please select different units."
      }, 400);
    }

    let numFactor = found.factor;
    if (factor !== undefined && factor !== null) {
      numFactor = parseFloat(factor);
      if (isNaN(numFactor) || numFactor <= 0) {
        return c.json({ success: false, error: "Factor must be a valid positive number" }, 400);
      }
    }

    // Check duplicate conversion for any other pair
    const existingList = await db
      .select()
      .from(unitConversions)
      .where(
        or(
          and(eq(unitConversions.purchaseUnit, pUnit), eq(unitConversions.salesUnit, sUnit)),
          and(eq(unitConversions.purchaseUnit, sUnit), eq(unitConversions.salesUnit, pUnit))
        )
      );

    const conflicting = existingList.find(
      (e) =>
        !(
          (e.purchaseUnit === oldP && e.salesUnit === oldS) ||
          (e.purchaseUnit === oldS && e.salesUnit === oldP)
        )
    );

    if (conflicting) {
      return c.json({
        success: false,
        error: `Conversion pair between "${pUnit}" and "${sUnit}" already exists.`
      }, 400);
    }

    const reverseFactor = Math.round((1 / numFactor) * 100000000) / 100000000;

    // Delete old reverse record if unit names changed
    if (oldP !== pUnit || oldS !== sUnit) {
      await db
        .delete(unitConversions)
        .where(and(eq(unitConversions.purchaseUnit, oldS), eq(unitConversions.salesUnit, oldP)));
    }

    // Update main forward record
    const [updated] = await db
      .update(unitConversions)
      .set({
        purchaseUnit: pUnit,
        salesUnit: sUnit,
        factor: numFactor,
        updatedAt: new Date()
      })
      .where(eq(unitConversions.id, id))
      .returning();

    // Upsert / update reverse record
    const [existingReverse] = await db
      .select()
      .from(unitConversions)
      .where(and(eq(unitConversions.purchaseUnit, sUnit), eq(unitConversions.salesUnit, pUnit)));

    if (existingReverse) {
      await db
        .update(unitConversions)
        .set({
          factor: reverseFactor,
          updatedAt: new Date()
        })
        .where(eq(unitConversions.id, existingReverse.id));
    } else {
      await db
        .insert(unitConversions)
        .values({
          purchaseUnit: sUnit,
          salesUnit: pUnit,
          factor: reverseFactor,
          createdAt: new Date(),
          updatedAt: new Date()
        });
    }

    notifySettingsUpdated("unit-conversions");
    return c.json({
      success: true,
      data: {
        ...updated,
        reverseFactor
      },
      message: "Unit conversion pair updated successfully"
    });
  } catch (error: any) {
    console.error("Error updating unit conversion:", error);
    return c.json({ success: false, error: error.message || "Failed to update unit conversion" }, 500);
  }
}

export async function deleteUnitConversion(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const [found] = await db.select().from(unitConversions).where(eq(unitConversions.id, id));
    if (!found) {
      return c.json({ success: false, error: "Unit conversion not found" }, 404);
    }

    // Delete both forward and reverse records
    await db
      .delete(unitConversions)
      .where(
        or(
          and(eq(unitConversions.purchaseUnit, found.purchaseUnit), eq(unitConversions.salesUnit, found.salesUnit)),
          and(eq(unitConversions.purchaseUnit, found.salesUnit), eq(unitConversions.salesUnit, found.purchaseUnit))
        )
      );

    notifySettingsUpdated("unit-conversions");
    return c.json({ success: true, message: "Unit conversion pair deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting unit conversion:", error);
    return c.json({ success: false, error: "Failed to delete unit conversion" }, 500);
  }
}

// 16. Public Platform Stats (For Login & Landing Pages)
export async function getPlatformPublicStats(c: Context) {
  try {
    const superadminRole = await db.query.roles.findFirst({
      where: eq(roles.name, "superadmin")
    });
    const superadminRoleId = superadminRole?.id ?? -1;

    // Count tenants (firm admins)
    const [tenantCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(ne(users.roleId, superadminRoleId), eq(users.status, "active")));

    // Count all users
    const [allUsersCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    // Count clients
    const [clientsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clients);

    const tenants = Number(tenantCount?.count || 0);
    const totalUsers = Number(allUsersCount?.count || 0);
    const totalClients = Number(clientsCount?.count || 0);

    return c.json({
      success: true,
      data: {
        tenants: tenants > 0 ? `${tenants}+` : "1+",
        users: totalUsers > 0 ? `${totalUsers}+` : "5+",
        clients: totalClients > 0 ? `${totalClients}+` : "10+"
      }
    });
  } catch (error: any) {
    return c.json({
      success: true,
      data: {
        tenants: "10+",
        users: "50+",
        clients: "100+"
      }
    });
  }
}

// 17. Live Notifications for SuperAdmin (Pending signups, wallet recharges & alerts)
export async function getNotifications(c: Context) {
  try {
    const pendingUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        status: users.status,
        planId: users.planId,
        trxId: users.trxId,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.status, "pending"))
      .orderBy(desc(users.createdAt));

    const signupNotifs = await Promise.all(
      pendingUsers.map(async (u) => {
        let planName = "Standard Plan";
        if (u.planId) {
          const [foundPlan] = await db.select().from(plans).where(eq(plans.id, u.planId));
          if (foundPlan?.name) planName = foundPlan.name;
        }
        return {
          id: -u.id,
          type: "signup_request",
          message: `New Tenant Registration: ${u.name} (${u.email}) - Plan: ${planName} - TrxID: ${u.trxId || "N/A"}`,
          createdAt: u.createdAt,
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          trxId: u.trxId
        };
      })
    );

    const pendingTransactions = await db
      .select({
        id: subscriptionTransactions.id,
        userId: subscriptionTransactions.userId,
        userName: users.name,
        userEmail: users.email,
        type: subscriptionTransactions.type,
        grossAmount: subscriptionTransactions.grossAmount,
        gatewayCharge: subscriptionTransactions.gatewayCharge,
        netAmount: subscriptionTransactions.netAmount,
        paidAmount: subscriptionTransactions.paidAmount,
        trxId: subscriptionTransactions.trxId,
        paymentMethod: subscriptionTransactions.paymentMethod,
        note: subscriptionTransactions.note,
        createdAt: subscriptionTransactions.createdAt
      })
      .from(subscriptionTransactions)
      .leftJoin(users, eq(subscriptionTransactions.userId, users.id))
      .where(
        and(
          eq(subscriptionTransactions.type, "deposit"),
          eq(subscriptionTransactions.status, "pending")
        )
      )
      .orderBy(desc(subscriptionTransactions.createdAt));

    const rechargeNotifs = pendingTransactions.map((tx) => ({
      id: `tx-${tx.id}`,
      type: "recharge_request",
      transactionId: tx.id,
      userId: tx.userId,
      userName: tx.userName || "Tenant",
      userEmail: tx.userEmail || "",
      grossAmount: tx.grossAmount || tx.paidAmount || 0,
      gatewayCharge: tx.gatewayCharge || 0,
      netAmount: tx.netAmount || ((tx.grossAmount || tx.paidAmount || 0) - (tx.gatewayCharge || 0)),
      trxId: tx.trxId,
      message: `Wallet Recharge: ${tx.userName || "Tenant"} deposited ৳${tx.paidAmount} (Net: ৳${tx.netAmount}) - bKash TrxID: ${tx.trxId || "N/A"}`,
      createdAt: tx.createdAt
    }));

    return c.json({ success: true, data: [...signupNotifs, ...rechargeNotifs] });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    return c.json({ success: true, data: [] });
  }
}

// 18. Get Pending Wallet Recharge Requests
export async function getPendingRecharges(c: Context) {
  try {
    const list = await db
      .select({
        id: subscriptionTransactions.id,
        userId: subscriptionTransactions.userId,
        userName: users.name,
        userEmail: users.email,
        userMobile: users.mobile,
        planId: subscriptionTransactions.planId,
        grossAmount: subscriptionTransactions.grossAmount,
        gatewayCharge: subscriptionTransactions.gatewayCharge,
        netAmount: subscriptionTransactions.netAmount,
        paidAmount: subscriptionTransactions.paidAmount,
        trxId: subscriptionTransactions.trxId,
        paymentMethod: subscriptionTransactions.paymentMethod,
        billingCycle: subscriptionTransactions.billingCycle,
        note: subscriptionTransactions.note,
        createdAt: subscriptionTransactions.createdAt
      })
      .from(subscriptionTransactions)
      .leftJoin(users, eq(subscriptionTransactions.userId, users.id))
      .where(
        and(
          eq(subscriptionTransactions.type, "deposit"),
          eq(subscriptionTransactions.status, "pending")
        )
      )
      .orderBy(desc(subscriptionTransactions.createdAt));

    return c.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching pending recharges:", error);
    return c.json({ success: false, error: "Failed to fetch pending recharges" }, 500);
  }
}

// 19. Approve Wallet Recharge (Credit Balance & Auto-Activate Plan if Sufficient)
export async function approveRecharge(c: Context) {
  try {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      try {
        body = (c.req as any).valid ? (c.req as any).valid("json") : {};
      } catch {
        body = {};
      }
    }
    let rawId =
      body?.transactionId ??
      body?.id ??
      body?.userId ??
      c.req.param("id") ??
      c.req.query("transactionId") ??
      c.req.query("id");

    if (typeof rawId === "string") {
      rawId = rawId.replace(/\D/g, "");
    }
    const transactionId = Number(rawId);
    if (!transactionId || isNaN(transactionId)) {
      return c.json({ success: false, message: "Valid transaction ID is required" }, 400);
    }

    const [tx] = await db
      .select()
      .from(subscriptionTransactions)
      .where(eq(subscriptionTransactions.id, transactionId));

    if (!tx) {
      return c.json({ success: false, message: "Transaction not found" }, 404);
    }

    if (tx.status !== "pending") {
      return c.json({ success: true, message: `Transaction is already ${tx.status}` });
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, tx.userId));
    if (!targetUser) {
      return c.json({ success: false, message: "Tenant user not found" }, 404);
    }

    const [paymentConfig] = await db.select().from(paymentSettings).limit(1);
    const chargePercent = paymentConfig?.bkashCharge ?? 1.8;

    const grossAmount = tx.grossAmount || tx.paidAmount || 0;
    const gatewayCharge =
      tx.gatewayCharge !== null && tx.gatewayCharge !== undefined
        ? tx.gatewayCharge
        : Math.round((grossAmount * chargePercent) / 100);
    const netDeposit = tx.netAmount || (grossAmount - gatewayCharge);

    const currentAdvance = targetUser.advanceBalance || 0;
    const totalWallet = currentAdvance + netDeposit;

    let plan = null;
    if (targetUser.planId) {
      const [foundPlan] = await db.select().from(plans).where(eq(plans.id, targetUser.planId));
      plan = foundPlan;
    }

    const isYearly =
      targetUser.billingCycle === "yearly" ||
      (targetUser.trxId
        ? targetUser.trxId.toLowerCase().includes("yearly") || targetUser.trxId.toLowerCase().includes("(y)")
        : false);
    const planPrice = isYearly ? plan?.rateYearly || 15000 : plan?.rateMonthly || 1500;

    const isExpiredOrInactive = !targetUser.expDate || new Date(targetUser.expDate) < new Date();

    let newExpDate = targetUser.expDate ? new Date(targetUser.expDate) : null;
    let finalAdvanceBalance = totalWallet;
    let planActivated = false;

    // If subscription is expired/inactive and total wallet balance now covers plan fee, auto-activate!
    if (isExpiredOrInactive && totalWallet >= planPrice) {
      finalAdvanceBalance = totalWallet - planPrice;
      planActivated = true;
      newExpDate = new Date();
      if (isYearly) {
        newExpDate.setFullYear(newExpDate.getFullYear() + 1);
      } else {
        newExpDate.setMonth(newExpDate.getMonth() + 1);
      }
    }

    // Update User Balance & Expiration
    await db
      .update(users)
      .set({
        advanceBalance: finalAdvanceBalance,
        expDate: newExpDate,
        status: "active",
        updatedAt: new Date()
      })
      .where(eq(users.id, targetUser.id));

    // Update Recharge Transaction to completed
    await db
      .update(subscriptionTransactions)
      .set({
        status: "completed",
        grossAmount,
        gatewayCharge,
        netAmount: netDeposit,
        excessCredit: netDeposit,
        note: `Recharge approved by SuperAdmin. ${planActivated ? `Plan ${plan?.name || ''} auto-activated.` : ''}`,
        updatedAt: new Date()
      })
      .where(eq(subscriptionTransactions.id, tx.id));

    // If plan auto-activated, insert plan activation record
    if (planActivated) {
      try {
        await db.insert(subscriptionTransactions).values({
          userId: targetUser.id,
          planId: targetUser.planId,
          type: "plan_fee",
          billingCycle: targetUser.billingCycle || "monthly",
          planRate: planPrice,
          paidAmount: 0,
          grossAmount: 0,
          gatewayCharge: 0,
          netAmount: -planPrice,
          excessCredit: 0,
          daysAdded: isYearly ? 365 : 30,
          paymentMethod: "wallet_balance",
          trxId: "WALLET-DEDUCTION",
          status: "completed",
          note: `Plan activated using available wallet balance after recharge verification.`
        });
      } catch (txErr) {
        console.error("Failed to log plan activation transaction:", txErr);
      }
    }

    // Broadcast Realtime Events
    try {
      broadcast(
        "tenant:recharge:approved",
        {
          transactionId: tx.id,
          userId: targetUser.id,
          planActivated,
          newBalance: finalAdvanceBalance
        },
        { users: [targetUser.id] }
      );
      broadcast(
        "user:updated",
        { userId: targetUser.id },
        { users: [targetUser.id] }
      );
    } catch (bErr) {
      console.error("Broadcast error:", bErr);
    }

    return c.json({
      success: true,
      message: `Recharge of ৳${grossAmount} (Net: ৳${netDeposit}) approved successfully.${planActivated ? ' Plan activated!' : ''}`,
      data: {
        transactionId: tx.id,
        netDeposit,
        finalAdvanceBalance,
        planActivated,
        expDate: newExpDate
      }
    });
  } catch (error: any) {
    console.error("Error approving recharge:", error);
    return c.json({ success: false, message: error?.message || "Failed to approve recharge" }, 500);
  }
}

// 20. Reject Wallet Recharge
export async function rejectRecharge(c: Context) {
  try {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      try {
        body = (c.req as any).valid ? (c.req as any).valid("json") : {};
      } catch {
        body = {};
      }
    }
    let rawId =
      body?.transactionId ??
      body?.id ??
      body?.userId ??
      c.req.param("id") ??
      c.req.query("transactionId") ??
      c.req.query("id");

    if (typeof rawId === "string") {
      rawId = rawId.replace(/\D/g, "");
    }
    const transactionId = Number(rawId);
    const reason = body?.reason || "Rejected by SuperAdmin (Invalid TrxID or payment not received)";

    if (!transactionId || isNaN(transactionId)) {
      return c.json({ success: false, message: "Valid transaction ID is required" }, 400);
    }

    const [tx] = await db
      .select()
      .from(subscriptionTransactions)
      .where(eq(subscriptionTransactions.id, transactionId));

    if (!tx) {
      return c.json({ success: false, message: "Transaction not found" }, 404);
    }

    await db
      .update(subscriptionTransactions)
      .set({
        status: "rejected",
        note: reason,
        updatedAt: new Date()
      })
      .where(eq(subscriptionTransactions.id, transactionId));

    return c.json({ success: true, message: "Recharge request rejected" });
  } catch (error: any) {
    console.error("Error rejecting recharge:", error);
    return c.json({ success: false, message: error?.message || "Failed to reject recharge" }, 500);
  }
}

// ── Global Service Units CRUD ────────────────────────────────
export async function getServiceUnits(c: Context) {
  try {
    const list = await db
      .select()
      .from(serviceUnits)
      .orderBy(desc(serviceUnits.id));

    return c.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching service units:", error);
    return c.json({ success: false, error: error.message || "Failed to fetch service units" }, 500);
  }
}

export async function createServiceUnit(c: Context) {
  try {
    const body = await c.req.json();
    const { code, name, description, isActive } = body;

    if (!code || !code.trim()) {
      return c.json({ success: false, error: "Unit code is required" }, 400);
    }
    if (!name || !name.trim()) {
      return c.json({ success: false, error: "Unit name is required" }, 400);
    }

    const trimmedCode = code.trim();
    const [existing] = await db
      .select()
      .from(serviceUnits)
      .where(sql`LOWER(TRIM(${serviceUnits.code})) = ${trimmedCode.toLowerCase()}`);

    if (existing) {
      return c.json({ success: false, error: `Unit code "${trimmedCode}" already exists.` }, 400);
    }

    const [inserted] = await db
      .insert(serviceUnits)
      .values({
        code: trimmedCode,
        name: name.trim(),
        description: description?.trim() || null,
        isActive: isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    notifySettingsUpdated("service-units");
    return c.json({ success: true, data: inserted, message: "Service unit created successfully" }, 201);
  } catch (error: any) {
    console.error("Error creating service unit:", error);
    if (error?.code === "23505") {
      return c.json({ success: false, error: "This Unit Code already exists." }, 400);
    }
    return c.json({ success: false, error: error.message || "Failed to create service unit" }, 500);
  }
}

export async function updateServiceUnit(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const { code, name, description, isActive } = body;

    const [found] = await db.select().from(serviceUnits).where(eq(serviceUnits.id, id));
    if (!found) return c.json({ success: false, error: "Service unit not found" }, 404);

    if (code) {
      const trimmedCode = code.trim();
      const [existing] = await db
        .select()
        .from(serviceUnits)
        .where(
          and(
            sql`LOWER(TRIM(${serviceUnits.code})) = ${trimmedCode.toLowerCase()}`,
            ne(serviceUnits.id, id)
          )
        );

      if (existing) {
        return c.json({ success: false, error: `Unit code "${trimmedCode}" is already in use.` }, 400);
      }
    }

    const [updated] = await db
      .update(serviceUnits)
      .set({
        ...(code && { code: code.trim() }),
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date()
      })
      .where(eq(serviceUnits.id, id))
      .returning();

    notifySettingsUpdated("service-units");
    return c.json({ success: true, data: updated, message: "Service unit updated successfully" });
  } catch (error: any) {
    console.error("Error updating service unit:", error);
    if (error?.code === "23505") {
      return c.json({ success: false, error: "This Unit Code already exists." }, 400);
    }
    return c.json({ success: false, error: error.message || "Failed to update service unit" }, 500);
  }
}

export async function toggleServiceUnitStatus(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    const [found] = await db.select().from(serviceUnits).where(eq(serviceUnits.id, id));
    if (!found) return c.json({ success: false, error: "Service unit not found" }, 404);

    const [updated] = await db
      .update(serviceUnits)
      .set({ isActive: !found.isActive, updatedAt: new Date() })
      .where(eq(serviceUnits.id, id))
      .returning();

    notifySettingsUpdated("service-units");
    return c.json({ success: true, data: updated, message: "Service unit status updated" });
  } catch (error: any) {
    console.error("Error toggling service unit status:", error);
    return c.json({ success: false, error: "Failed to toggle status" }, 500);
  }
}

export async function deleteServiceUnit(c: Context) {
  try {
    const id = Number(c.req.param("id"));
    await db.delete(serviceUnits).where(eq(serviceUnits.id, id));
    notifySettingsUpdated("service-units");
    return c.json({ success: true, message: "Service unit deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting service unit:", error);
    return c.json({ success: false, error: "Failed to delete service unit" }, 500);
  }
}




