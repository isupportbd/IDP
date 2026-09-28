import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import type { Handler } from "hono";
import { broadcast, db, HttpStatusCodes, resolveTenantContext } from "@/framework/facade.js";
import { fetchProviderBalance } from "@/framework/sms/index.js";
import { users } from "@/modules/auth/database/models/user.js";
import { companySettings } from "../database/models/company_settings.js";
import { bankAccounts } from "../database/models/bank_accounts.js";
import { expenseHeads } from "../database/models/expense_heads.js";

// ── COMPANY SETTINGS CONTROLLERS ─────────────────────────────────────

export const getCompanySettings: Handler = async (c: any) => {
  try {
    const { isSuperAdmin, tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    let settings = (
      await db
        .select()
        .from(companySettings)
        .where(
          isSuperAdmin
            ? or(eq(companySettings.adminId, targetAdminId), sql`${companySettings.adminId} IS NULL`)
            : or(eq(companySettings.adminId, targetAdminId), sql`${companySettings.adminId} IS NULL`)
        )
        .orderBy(desc(companySettings.adminId))
        .limit(1)
    )[0];

    if (!settings) {
      // Create initial settings record for this tenant
      settings = (
        await db
          .insert(companySettings)
          .values({ adminId: targetAdminId })
          .returning()
      )[0];
    }
    return c.json({ message: "Company settings retrieved", data: settings }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to fetch company settings" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const updateCompanySettings: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const { isSuperAdmin, tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    let existing = (
      await db
        .select()
        .from(companySettings)
        .where(
          isSuperAdmin
            ? or(eq(companySettings.adminId, targetAdminId), sql`${companySettings.adminId} IS NULL`)
            : eq(companySettings.adminId, targetAdminId)
        )
        .limit(1)
    )[0];

    let result: any = null;
    if (existing) {
      result = (
        await db
          .update(companySettings)
          .set({
            ...body,
            adminId: existing.adminId || targetAdminId,
            updatedAt: new Date()
          })
          .where(eq(companySettings.id, existing.id))
          .returning()
      )[0];
    } else {
      result = (
        await db
          .insert(companySettings)
          .values({
            ...body,
            adminId: targetAdminId
          })
          .returning()
      )[0];
    }

    // If SMS API key is saved, sync real-time stock directly from provider
    if (body.smsApiKey && body.smsApiKey.trim()) {
      try {
        const liveBalance = await fetchProviderBalance(body.smsApiKey.trim());
        if (liveBalance !== null && targetAdminId) {
          await db.update(users).set({ smsBalance: liveBalance, updatedAt: new Date() }).where(eq(users.id, targetAdminId));
          broadcast(
            "tenant:sms-updated",
            {
              adminId: targetAdminId,
              smsBalance: liveBalance,
              timestamp: Date.now()
            },
            { all: true, auth: true }
          );
        }
      } catch (smsErr) {
        console.error("Error syncing provider SMS balance on settings save:", smsErr);
      }
    }

    return c.json({ message: "Company settings updated successfully", data: result }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to update company settings" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── BANK ACCOUNTS CONTROLLERS ────────────────────────────────────────

export const listBankAccounts: Handler = async (c: any) => {
  try {
    const { isSuperAdmin, tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    const list = await db
      .select()
      .from(bankAccounts)
      .where(
        isSuperAdmin
          ? undefined
          : or(eq(bankAccounts.adminId, targetAdminId), sql`${bankAccounts.adminId} IS NULL`)
      )
      .orderBy(desc(bankAccounts.isDefault), asc(bankAccounts.id));

    return c.json({ message: "Bank accounts fetched successfully", data: list }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to fetch bank accounts" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const createBankAccount: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const { tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    if (body.isDefault) {
      await db
        .update(bankAccounts)
        .set({ isDefault: false })
        .where(or(eq(bankAccounts.adminId, targetAdminId), sql`${bankAccounts.adminId} IS NULL`));
    }

    const inserted = (
      await db
        .insert(bankAccounts)
        .values({
          ...body,
          adminId: targetAdminId
        })
        .returning()
    )[0];

    return c.json({ message: "Bank account added successfully", data: inserted }, HttpStatusCodes.CREATED);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to create bank account" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const updateBankAccount: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const { isSuperAdmin, tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    const existing = (
      await db
        .select()
        .from(bankAccounts)
        .where(
          and(
            eq(bankAccounts.id, id),
            isSuperAdmin
              ? undefined
              : or(eq(bankAccounts.adminId, targetAdminId), sql`${bankAccounts.adminId} IS NULL`)
          )
        )
        .limit(1)
    )[0];

    if (!existing) {
      return c.json({ message: "Bank account not found" }, HttpStatusCodes.NOT_FOUND);
    }

    if (body.isDefault) {
      await db
        .update(bankAccounts)
        .set({ isDefault: false })
        .where(or(eq(bankAccounts.adminId, targetAdminId), sql`${bankAccounts.adminId} IS NULL`));
    }

    const updated = (
      await db
        .update(bankAccounts)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(bankAccounts.id, id))
        .returning()
    )[0];

    return c.json({ message: "Bank account updated successfully", data: updated }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to update bank account" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const deleteBankAccount: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const { isSuperAdmin, tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    const existing = (
      await db
        .select()
        .from(bankAccounts)
        .where(
          and(
            eq(bankAccounts.id, id),
            isSuperAdmin
              ? undefined
              : or(eq(bankAccounts.adminId, targetAdminId), sql`${bankAccounts.adminId} IS NULL`)
          )
        )
        .limit(1)
    )[0];

    if (!existing) {
      return c.json({ message: "Bank account not found" }, HttpStatusCodes.NOT_FOUND);
    }

    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
    return c.json({ message: "Bank account removed successfully" }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to delete bank account" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── EXPENSE HEADS CONTROLLERS ────────────────────────────────────────

export const listExpenseHeads: Handler = async (c: any) => {
  try {
    const { isSuperAdmin, tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    const list = await db
      .select()
      .from(expenseHeads)
      .where(
        isSuperAdmin
          ? undefined
          : or(eq(expenseHeads.adminId, targetAdminId), sql`${expenseHeads.adminId} IS NULL`)
      )
      .orderBy(asc(expenseHeads.id));

    return c.json({ message: "Expense heads fetched successfully", data: list }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to fetch expense heads" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const createExpenseHead: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const trimmedName = body.name.trim();
    const { tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    const existing = (
      await db
        .select()
        .from(expenseHeads)
        .where(
          and(
            eq(expenseHeads.name, trimmedName),
            or(eq(expenseHeads.adminId, targetAdminId), sql`${expenseHeads.adminId} IS NULL`)
          )
        )
        .limit(1)
    )[0];

    if (existing) {
      return c.json({ message: `Expense head "${trimmedName}" already exists` }, HttpStatusCodes.CONFLICT);
    }

    const inserted = (
      await db
        .insert(expenseHeads)
        .values({
          ...body,
          adminId: targetAdminId,
          name: trimmedName,
          code: body.code?.trim() || null,
          description: body.description?.trim() || null
        })
        .returning()
    )[0];

    return c.json({ message: "Expense head created successfully", data: inserted }, HttpStatusCodes.CREATED);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to create expense head" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const updateExpenseHead: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const { isSuperAdmin, tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    const existing = (
      await db
        .select()
        .from(expenseHeads)
        .where(
          and(
            eq(expenseHeads.id, id),
            isSuperAdmin
              ? undefined
              : or(eq(expenseHeads.adminId, targetAdminId), sql`${expenseHeads.adminId} IS NULL`)
          )
        )
        .limit(1)
    )[0];

    if (!existing) {
      return c.json({ message: "Expense head not found" }, HttpStatusCodes.NOT_FOUND);
    }

    if (body.name) {
      const duplicate = (
        await db
          .select()
          .from(expenseHeads)
          .where(
            and(
              eq(expenseHeads.name, body.name.trim()),
              or(eq(expenseHeads.adminId, targetAdminId), sql`${expenseHeads.adminId} IS NULL`)
            )
          )
          .limit(1)
      )[0];

      if (duplicate && duplicate.id !== id) {
        return c.json({ message: `Expense head "${body.name}" already exists` }, HttpStatusCodes.CONFLICT);
      }
    }

    const updated = (
      await db
        .update(expenseHeads)
        .set({
          ...body,
          name: body.name ? body.name.trim() : undefined,
          code: body.code !== undefined ? (body.code ? body.code.trim() : null) : undefined,
          description: body.description !== undefined ? (body.description ? body.description.trim() : null) : undefined,
          updatedAt: new Date()
        })
        .where(eq(expenseHeads.id, id))
        .returning()
    )[0];

    return c.json({ message: "Expense head updated successfully", data: updated }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to update expense head" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const toggleExpenseHead: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const { isSuperAdmin, tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    const existing = (
      await db
        .select()
        .from(expenseHeads)
        .where(
          and(
            eq(expenseHeads.id, id),
            isSuperAdmin
              ? undefined
              : or(eq(expenseHeads.adminId, targetAdminId), sql`${expenseHeads.adminId} IS NULL`)
          )
        )
        .limit(1)
    )[0];

    if (!existing) {
      return c.json({ message: "Expense head not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const updated = (
      await db
        .update(expenseHeads)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(expenseHeads.id, id))
        .returning()
    )[0];

    return c.json({ message: "Expense head status updated", data: updated }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to toggle expense head" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const deleteExpenseHead: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const { isSuperAdmin, tenantAdminId } = await resolveTenantContext(c);
    const targetAdminId = tenantAdminId || 1;

    const existing = (
      await db
        .select()
        .from(expenseHeads)
        .where(
          and(
            eq(expenseHeads.id, id),
            isSuperAdmin
              ? undefined
              : or(eq(expenseHeads.adminId, targetAdminId), sql`${expenseHeads.adminId} IS NULL`)
          )
        )
        .limit(1)
    )[0];

    if (!existing) {
      return c.json({ message: "Expense head not found" }, HttpStatusCodes.NOT_FOUND);
    }

    await db.delete(expenseHeads).where(eq(expenseHeads.id, id));
    return c.json({ message: "Expense head deleted successfully" }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to delete expense head" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
