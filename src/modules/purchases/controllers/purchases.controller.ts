import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { Handler } from "hono";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { purchases } from "@/modules/clients/database/models/purchases.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { globalItems } from "@/modules/superadmin/database/models/global_items.js";
import { vatSubmissions } from "@/modules/clients/database/models/vat_submissions.js";
import { users } from "@/modules/auth/database/models/user.js";

// ── GET PURCHASES LIST ───────────────────────────────────────────────

export const listPurchases: Handler = async (c: any) => {
  try {
    const auth = c.get("auth") || c.get("user");
    let tenantAdminId = 1;
    let isSuperAdmin = false;

    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(auth.id)),
        with: { role: true }
      });
      if (currentUser) {
        isSuperAdmin = currentUser.role?.name?.toLowerCase() === "superadmin";
        tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;
      }
    }

    const month = c.req.query("month");
    const clientId = c.req.query("clientId");
    const referenceId = c.req.query("referenceId");
    const search = c.req.query("search");
    const sortDir = c.req.query("sortDir") || c.req.query("order") || "desc";
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "15", 10);
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (!isSuperAdmin) {
      conditions.push(eq(purchases.adminId, tenantAdminId));
    }
    if (month) {
      conditions.push(eq(purchases.month, month));
    }
    if (clientId) {
      conditions.push(eq(purchases.clientId, Number(clientId)));
    }
    if (referenceId) {
      conditions.push(eq(clients.referenceId, Number(referenceId)));
    }
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(purchases.beNo, s),
          ilike(purchases.office, s),
          ilike(purchases.lcNumber, s),
          ilike(clients.companyName, s),
          ilike(clients.binNumber, s),
          ilike(globalItems.name, s),
          ilike(globalItems.hsCode, s)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchases)
      .leftJoin(clients, eq(purchases.clientId, clients.id))
      .leftJoin(globalItems, eq(purchases.itemId, globalItems.id))
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    const orderClause = sortDir === "asc"
      ? [asc(purchases.beDate), asc(purchases.id)]
      : [desc(purchases.beDate), desc(purchases.id)];

    // Fetch records
    const records = await db
      .select({
        id: purchases.id,
        clientId: purchases.clientId,
        clientName: clients.companyName,
        clientBin: clients.binNumber,
        office: purchases.office,
        beNo: purchases.beNo,
        beDate: purchases.beDate,
        month: purchases.month,
        lcNumber: purchases.lcNumber,
        netWt: purchases.netWt,
        excessQty: purchases.excessQty,
        totalQty: purchases.totalQty,
        assValue: purchases.assValue,
        unitValue: purchases.unitValue,
        cd: purchases.cd,
        rd: purchases.rd,
        sd: purchases.sd,
        baseValueOfVat: purchases.baseValueOfVat,
        vat: purchases.vat,
        at: purchases.at,
        isRebate: purchases.isRebate,
        isFfs: purchases.isFfs,
        itemId: purchases.itemId,
        itemName: globalItems.name,
        hsCode: globalItems.hsCode,
        createdAt: purchases.createdAt
      })
      .from(purchases)
      .leftJoin(clients, eq(purchases.clientId, clients.id))
      .leftJoin(globalItems, eq(purchases.itemId, globalItems.id))
      .where(whereClause)
      .orderBy(...orderClause)
      .limit(limit)
      .offset(offset);

    return c.json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit))
      }
    });
  } catch (error: any) {
    console.error("Error fetching purchases:", error);
    return c.json(
      { success: false, message: error.message || "Failed to fetch purchases" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── DELETE SINGLE PURCHASE ───────────────────────────────────────────

export const deletePurchase: Handler = async (c: any) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (!id || isNaN(id)) {
      return c.json({ success: false, message: "Invalid ID" }, HttpStatusCodes.BAD_REQUEST);
    }

    const auth = c.get("auth") || c.get("user");
    let tenantAdminId = 1;
    let isSuperAdmin = false;

    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(auth.id)),
        with: { role: true }
      });
      if (currentUser) {
        isSuperAdmin = currentUser.role?.name?.toLowerCase() === "superadmin";
        tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;
      }
    }

    const whereCondition = isSuperAdmin
      ? eq(purchases.id, id)
      : and(eq(purchases.id, id), eq(purchases.adminId, tenantAdminId));

    await db.delete(purchases).where(whereCondition);

    return c.json({ success: true, message: "Purchase record deleted successfully" });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message || "Failed to delete purchase" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── BATCH DELETE PURCHASES ───────────────────────────────────────────

export const batchDeletePurchases: Handler = async (c: any) => {
  try {
    const { month, clientId, ids } = await c.req.json();
    const auth = c.get("auth") || c.get("user");
    let tenantAdminId = 1;
    let isSuperAdmin = false;

    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(auth.id)),
        with: { role: true }
      });
      if (currentUser) {
        isSuperAdmin = currentUser.role?.name?.toLowerCase() === "superadmin";
        tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;
      }
    }

    const conditions: any[] = [];
    if (!isSuperAdmin) {
      conditions.push(eq(purchases.adminId, tenantAdminId));
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      conditions.push(inArray(purchases.id, ids.map(Number)));
    } else {
      if (month) conditions.push(eq(purchases.month, month));
      if (clientId) conditions.push(eq(purchases.clientId, Number(clientId)));
    }

    if (conditions.length === (isSuperAdmin ? 0 : 1)) {
      return c.json(
        { success: false, message: "Please specify month, client, or specific record IDs for batch deletion." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    await db.delete(purchases).where(and(...conditions));

    return c.json({ success: true, message: "Purchase records deleted successfully" });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message || "Failed to batch delete purchases" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── DELETE PURCHASES BY MONTH ────────────────────────────────────────

export const deletePurchasesByMonth: Handler = async (c: any) => {
  try {
    const month = c.req.param("month");
    if (!month) {
      return c.json({ success: false, message: "Month is required" }, HttpStatusCodes.BAD_REQUEST);
    }

    const auth = c.get("auth") || c.get("user");
    let tenantAdminId = 1;
    let isSuperAdmin = false;

    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(auth.id)),
        with: { role: true }
      });
      if (currentUser) {
        isSuperAdmin = currentUser.role?.name?.toLowerCase() === "superadmin";
        tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;
      }
    }

    const conditions = [eq(purchases.month, month)];
    if (!isSuperAdmin) {
      conditions.push(eq(purchases.adminId, tenantAdminId));
    }

    await db.delete(purchases).where(and(...conditions));

    return c.json({ success: true, message: `All purchases for ${month} deleted successfully` });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message || "Failed to delete purchases by month" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── GET CLIENT PURCHASES & SUBMISSIONS MONTHS OVERVIEW ─────────────────

export const getPurchasesMonths: Handler = async (c: any) => {
  try {
    const clientId = c.req.query("clientId");
    const auth = c.get("auth") || c.get("user");
    let tenantAdminId = 1;
    let isSuperAdmin = false;

    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(auth.id)),
        with: { role: true }
      });
      if (currentUser) {
        isSuperAdmin = currentUser.role?.name?.toLowerCase() === "superadmin";
        tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;
      }
    }

    const purchaseConditions: any[] = [];
    if (!isSuperAdmin) {
      purchaseConditions.push(eq(purchases.adminId, tenantAdminId));
    }
    if (clientId) {
      purchaseConditions.push(eq(purchases.clientId, Number(clientId)));
    }

    // 1. Fetch distinct purchase months
    const purchaseMonthsResult = await db
      .select({ month: purchases.month })
      .from(purchases)
      .where(purchaseConditions.length > 0 ? and(...purchaseConditions) : undefined)
      .groupBy(purchases.month)
      .orderBy(desc(purchases.month));

    const purchaseMonths = purchaseMonthsResult
      .map((r) => r.month)
      .filter(Boolean) as string[];

    // 2. Fetch submissions for the client
    const submissionMonths: string[] = [];
    const submissionsMap: Record<string, string> = {};

    if (clientId) {
      const subsResult = await db
        .select({
          taxPeriod: vatSubmissions.taxPeriod,
          submissionId: vatSubmissions.submissionId
        })
        .from(vatSubmissions)
        .where(eq(vatSubmissions.clientId, Number(clientId)));

      subsResult.forEach((s) => {
        if (s.taxPeriod && s.submissionId) {
          submissionMonths.push(s.taxPeriod);
          submissionsMap[s.taxPeriod] = s.submissionId;
        }
      });
    }

    // Combine all available active months
    const allMonthsSet = new Set<string>([...purchaseMonths, ...submissionMonths]);
    const allMonths = Array.from(allMonthsSet).sort((a, b) => b.localeCompare(a));

    return c.json({
      success: true,
      data: allMonths,
      overview: {
        purchaseMonths,
        submissionMonths,
        submissionsMap,
        allMonths
      }
    });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message || "Failed to fetch purchases months" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};


