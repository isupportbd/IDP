import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Handler } from "hono";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { salesRates } from "@/modules/clients/database/models/sales_rates.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { globalItems } from "@/modules/superadmin/database/models/global_items.js";
import { unitConversions } from "@/modules/superadmin/database/models/unit_conversions.js";
import { users } from "@/modules/auth/database/models/user.js";

// ── 1. LIST SALES RATES ───────────────────────────────────────────────
export const listSalesRates: Handler = async (c: any) => {
  try {
    const auth = c.get("auth") || c.get("user");
    const role = auth?.role;
    const adminId = auth?.adminId || auth?.id;

    const query = c.req.valid("query") || {};
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 500);
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (role && role !== "superadmin" && adminId) {
      conditions.push(eq(salesRates.adminId, adminId));
    }

    if (query.clientId) {
      conditions.push(eq(salesRates.clientId, Number(query.clientId)));
    }

    if (query.itemId) {
      conditions.push(eq(salesRates.itemId, Number(query.itemId)));
    }

    if (query.status && query.status !== "all") {
      conditions.push(eq(salesRates.status, query.status));
    }

    if (query.clientFilter && query.clientFilter.trim()) {
      conditions.push(ilike(clients.companyName, `%${query.clientFilter.trim()}%`));
    }

    if (query.itemFilter && query.itemFilter.trim()) {
      conditions.push(ilike(globalItems.name, `%${query.itemFilter.trim()}%`));
    }

    if (query.rateFilter && !isNaN(Number(query.rateFilter))) {
      conditions.push(eq(salesRates.salesRate, Number(query.rateFilter)));
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(clients.companyName, term),
          ilike(clients.binNumber, term),
          ilike(globalItems.name, term),
          ilike(globalItems.hsCode, term)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total Count
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salesRates)
      .leftJoin(clients, eq(salesRates.clientId, clients.id))
      .leftJoin(globalItems, eq(salesRates.itemId, globalItems.id))
      .where(whereClause);
    const total = totalResult[0]?.count || 0;

    // Fetch Rows
    const rows = await db
      .select({
        id: salesRates.id,
        clientId: salesRates.clientId,
        clientName: clients.companyName,
        clientBin: clients.binNumber,
        itemId: salesRates.itemId,
        itemName: globalItems.name,
        itemHsCode: globalItems.hsCode,
        unitId: salesRates.unitId,
        unitName: unitConversions.salesUnit,
        purchaseUnit: unitConversions.purchaseUnit,
        factor: unitConversions.factor,
        salesRate: salesRates.salesRate,
        vatRate: salesRates.vatRate,
        vatableValue: salesRates.vatableValue,
        additionPercent: salesRates.additionPercent,
        activationDate: salesRates.activationDate,
        status: salesRates.status,
        createdAt: salesRates.createdAt
      })
      .from(salesRates)
      .leftJoin(clients, eq(salesRates.clientId, clients.id))
      .leftJoin(globalItems, eq(salesRates.itemId, globalItems.id))
      .leftJoin(unitConversions, eq(salesRates.unitId, unitConversions.id))
      .where(whereClause)
      .orderBy(desc(salesRates.id))
      .limit(limit)
      .offset(offset);

    return c.json({
      success: true,
      message: "Sales rates fetched successfully",
      data: rows.map((r) => ({
        ...r,
        unitName: r.unitName || "MT",
        clientBin: r.clientBin || "—",
        itemHsCode: r.itemHsCode || "—"
      })),
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    console.error("Error fetching sales rates:", err);
    return c.json({ success: false, message: err.message || "Failed to fetch sales rates", data: [] }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 2. CREATE SALES RATE ──────────────────────────────────────────────
export const createSalesRate: Handler = async (c: any) => {
  try {
    const auth = c.get("auth") || c.get("user");
    let adminId = auth?.adminId || auth?.id;
    if (!adminId) {
      return c.json({ success: false, message: "Unauthorized: tenant admin required" }, HttpStatusCodes.UNAUTHORIZED);
    }
    const body = c.req.valid("json");

    const clientId = Number(body.clientId);
    const itemId = Number(body.itemId);
    const unitId = body.unitId ? Number(body.unitId) : null;
    const salesRate = Number(body.salesRate);
    const vatRate = Number(body.vatRate);
    const additionPercent = body.additionPercent !== undefined ? Number(body.additionPercent) : 36;
    const status = body.status || "Active";
    const activationDate = body.activationDate;

    // Realtime vatable value calculation
    const vatableValue = Number((salesRate / (1 + vatRate / 100)).toFixed(6));

    // If new rate is Active, archive previously Active rates for same client + item to Frozen
    if (status === "Active") {
      await db
        .update(salesRates)
        .set({ status: "Frozen", updatedAt: new Date() })
        .where(
          and(
            eq(salesRates.clientId, clientId),
            eq(salesRates.itemId, itemId),
            eq(salesRates.status, "Active")
          )
        );
    }

    const [newRate] = await db
      .insert(salesRates)
      .values({
        adminId,
        clientId,
        itemId,
        unitId,
        salesRate,
        vatRate,
        vatableValue,
        additionPercent,
        activationDate,
        status
      })
      .returning();

    return c.json(
      {
        success: true,
        message: "Sales rate created successfully",
        data: newRate
      },
      HttpStatusCodes.CREATED
    );
  } catch (err: any) {
    console.error("Error creating sales rate:", err);
    return c.json({ success: false, message: err.message || "Failed to create sales rate" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 3. UPDATE SALES RATE ──────────────────────────────────────────────
export const updateSalesRate: Handler = async (c: any) => {
  try {
    const id = Number(c.req.param("id"));
    if (!id || isNaN(id)) {
      return c.json({ success: false, message: "Invalid sales rate ID" }, HttpStatusCodes.BAD_REQUEST);
    }

    const body = c.req.valid("json");
    const updateData: any = { updatedAt: new Date() };

    if (body.salesRate !== undefined) updateData.salesRate = Number(body.salesRate);
    if (body.vatRate !== undefined) updateData.vatRate = Number(body.vatRate);
    if (body.additionPercent !== undefined) updateData.additionPercent = Number(body.additionPercent);
    if (body.unitId !== undefined) updateData.unitId = body.unitId ? Number(body.unitId) : null;
    if (body.activationDate !== undefined) updateData.activationDate = body.activationDate;
    if (body.status !== undefined) updateData.status = body.status;

    if (updateData.salesRate !== undefined && updateData.vatRate !== undefined) {
      updateData.vatableValue = Number((updateData.salesRate / (1 + updateData.vatRate / 100)).toFixed(6));
    }

    const [updated] = await db
      .update(salesRates)
      .set(updateData)
      .where(eq(salesRates.id, id))
      .returning();

    if (!updated) {
      return c.json({ success: false, message: "Sales rate not found" }, HttpStatusCodes.NOT_FOUND);
    }

    return c.json({
      success: true,
      message: "Sales rate updated successfully",
      data: updated
    });
  } catch (err: any) {
    console.error("Error updating sales rate:", err);
    return c.json({ success: false, message: err.message || "Failed to update sales rate" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 4. DELETE SALES RATE ──────────────────────────────────────────────
export const deleteSalesRate: Handler = async (c: any) => {
  try {
    const id = Number(c.req.param("id"));
    if (!id || isNaN(id)) {
      return c.json({ success: false, message: "Invalid sales rate ID" }, HttpStatusCodes.BAD_REQUEST);
    }

    // Get current rate details before deletion
    const existing = await db.select().from(salesRates).where(eq(salesRates.id, id)).limit(1);
    if (existing.length === 0) {
      return c.json({ success: false, message: "Sales rate not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const rate = existing[0];
    await db.delete(salesRates).where(eq(salesRates.id, id));

    // If deleted rate was Active, unfreeze / activate most recent historical rate for same client + item
    if (rate.status === "Active") {
      const remainingFrozen = await db
        .select()
        .from(salesRates)
        .where(
          and(
            eq(salesRates.clientId, rate.clientId),
            eq(salesRates.itemId, rate.itemId)
          )
        )
        .orderBy(desc(salesRates.activationDate), desc(salesRates.id))
        .limit(1);

      if (remainingFrozen.length > 0) {
        await db
          .update(salesRates)
          .set({ status: "Active", updatedAt: new Date() })
          .where(eq(salesRates.id, remainingFrozen[0].id));
      }
    }

    return c.json({
      success: true,
      message: "Sales rate deleted successfully"
    });
  } catch (err: any) {
    console.error("Error deleting sales rate:", err);
    return c.json({ success: false, message: err.message || "Failed to delete sales rate" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 5. GET RATE HISTORY ───────────────────────────────────────────────
export const getRateHistory: Handler = async (c: any) => {
  try {
    const clientId = Number(c.req.query("clientId"));
    const itemId = Number(c.req.query("itemId"));

    if (!clientId || !itemId) {
      return c.json({ success: false, message: "clientId and itemId query parameters are required" }, HttpStatusCodes.BAD_REQUEST);
    }

    const rows = await db
      .select({
        id: salesRates.id,
        clientId: salesRates.clientId,
        clientName: clients.companyName,
        itemId: salesRates.itemId,
        itemName: globalItems.name,
        unitId: salesRates.unitId,
        unitName: unitConversions.salesUnit,
        salesRate: salesRates.salesRate,
        vatRate: salesRates.vatRate,
        vatableValue: salesRates.vatableValue,
        additionPercent: salesRates.additionPercent,
        activationDate: salesRates.activationDate,
        status: salesRates.status,
        createdAt: salesRates.createdAt
      })
      .from(salesRates)
      .leftJoin(clients, eq(salesRates.clientId, clients.id))
      .leftJoin(globalItems, eq(salesRates.itemId, globalItems.id))
      .leftJoin(unitConversions, eq(salesRates.unitId, unitConversions.id))
      .where(and(eq(salesRates.clientId, clientId), eq(salesRates.itemId, itemId)))
      .orderBy(desc(salesRates.activationDate), desc(salesRates.id));

    return c.json({
      success: true,
      data: rows.map((r) => ({ ...r, unitName: r.unitName || "MT" }))
    });
  } catch (err: any) {
    console.error("Error fetching rate history:", err);
    return c.json({ success: false, message: err.message || "Failed to fetch rate history", data: [] }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
