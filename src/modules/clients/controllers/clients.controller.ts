import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import type { Handler } from "hono";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { clients } from "../database/models/clients.js";
import { clientManagers } from "../database/models/client_managers.js";
import { customerTypes } from "@/modules/services/database/models/customer_types.js";
import { clientReferences } from "@/modules/services/database/models/references.js";
import { users } from "@/modules/auth/database/models/user.js";
import { roles } from "@/modules/auth/database/models/role.js";
import { companySettings } from "@/modules/firm/database/models/company_settings.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";
import { purchases } from "../database/models/purchases.js";
import { globalItems } from "@/modules/superadmin/database/models/global_items.js";

// ── 1. LIST CLIENTS WITH FILTERS & PAGINATION ────────────────────────

export const listClients: Handler = async (c: any) => {
  try {
    const query = c.req.valid("query");
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(clients.companyName, term),
          ilike(clients.binNumber, term),
          ilike(clients.mobile, term),
          ilike(clients.proprietorName, term)
        )
      );
    }

    if (query.customerTypeId) {
      conditions.push(eq(clients.customerTypeId, query.customerTypeId));
    }

    if (query.referenceId) {
      conditions.push(eq(clients.referenceId, query.referenceId));
    }

    if (query.isActive && query.isActive !== "all") {
      conditions.push(eq(clients.isActive, query.isActive === "true"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total Count
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(whereClause);
    const total = totalResult[0]?.count || 0;

    // Fetch Paginated Rows
    const rows = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        proprietorName: clients.proprietorName,
        mobile: clients.mobile,
        alternativeMobile: clients.alternativeMobile,
        email: clients.email,
        address: clients.address,
        binNumber: clients.binNumber,
        tinNumber: clients.tinNumber,
        tradeLicenseNo: clients.tradeLicenseNo,
        customerTypeId: clients.customerTypeId,
        customerTypeName: customerTypes.typeName,
        referenceId: clients.referenceId,
        referenceName: clientReferences.name,
        vatUserId: clients.vatUserId,
        vatPassword: clients.vatPassword,
        vatServiceType: clients.vatServiceType,
        openingBalance: clients.openingBalance,
        isActive: clients.isActive,
        notes: clients.notes,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt
      })
      .from(clients)
      .leftJoin(customerTypes, eq(clients.customerTypeId, customerTypes.id))
      .leftJoin(clientReferences, eq(clients.referenceId, clientReferences.id))
      .where(whereClause)
      .orderBy(desc(clients.id))
      .limit(limit)
      .offset(offset);

    // Attach Assigned Managers
    const clientIds = rows.map((r) => r.id);
    let managerMap: Record<number, any[]> = {};

    if (clientIds.length > 0) {
      const allManagers = await db
        .select({
          clientId: clientManagers.clientId,
          managerId: clientManagers.managerId,
          managerName: users.name,
          managerEmail: users.email
        })
        .from(clientManagers)
        .innerJoin(users, eq(clientManagers.managerId, users.id))
        .where(inArray(clientManagers.clientId, clientIds));

      for (const m of allManagers) {
        if (!managerMap[m.clientId]) {
          managerMap[m.clientId] = [];
        }
        managerMap[m.clientId].push({
          id: m.managerId,
          name: m.managerName,
          email: m.managerEmail
        });
      }
    }

    const data = rows.map((r) => ({
      ...r,
      managers: managerMap[r.id] || []
    }));

    return c.json(
      {
        message: "Clients fetched successfully",
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to list clients" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 2. GET SINGLE CLIENT BY ID ───────────────────────────────────────

export const getClientById: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const row = (
      await db
        .select({
          id: clients.id,
          companyName: clients.companyName,
          proprietorName: clients.proprietorName,
          mobile: clients.mobile,
          alternativeMobile: clients.alternativeMobile,
          email: clients.email,
          address: clients.address,
          binNumber: clients.binNumber,
          tinNumber: clients.tinNumber,
          tradeLicenseNo: clients.tradeLicenseNo,
          customerTypeId: clients.customerTypeId,
          customerTypeName: customerTypes.typeName,
          referenceId: clients.referenceId,
          referenceName: clientReferences.name,
          vatUserId: clients.vatUserId,
          vatPassword: clients.vatPassword,
          vatServiceType: clients.vatServiceType,
          openingBalance: clients.openingBalance,
          isActive: clients.isActive,
          notes: clients.notes,
          createdAt: clients.createdAt,
          updatedAt: clients.updatedAt
        })
        .from(clients)
        .leftJoin(customerTypes, eq(clients.customerTypeId, customerTypes.id))
        .leftJoin(clientReferences, eq(clients.referenceId, clientReferences.id))
        .where(eq(clients.id, id))
        .limit(1)
    )[0];

    if (!row) {
      return c.json({ message: "Client not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const assignedManagers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(clientManagers)
      .innerJoin(users, eq(clientManagers.managerId, users.id))
      .where(eq(clientManagers.clientId, id));

    return c.json(
      {
        message: "Client retrieved successfully",
        data: {
          ...row,
          managers: assignedManagers
        }
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to get client" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 3. CREATE CLIENT ─────────────────────────────────────────────────

export const createClient: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const trimmedBin = body.binNumber?.trim();

    // 1. Check Tenant Subscription Plan Client Limit
    const auth = c.get("auth");
    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, auth.id),
        with: { role: true }
      });
      const isSuperAdmin = currentUser?.role?.name?.toLowerCase() === "superadmin";

      if (!isSuperAdmin && currentUser) {
        const tenantAdminId = currentUser.adminId || currentUser.id;
        const tenantAdmin = await db.query.users.findFirst({
          where: eq(users.id, tenantAdminId)
        });

        if (tenantAdmin?.planId) {
          const [plan] = await db.select().from(plans).where(eq(plans.id, tenantAdmin.planId));
          const maxClientsAllowed = plan?.maxClients ?? 50;

          const [clientCountResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(clients);

          const currentCount = clientCountResult?.count || 0;
          if (currentCount >= maxClientsAllowed) {
            return c.json(
              {
                message: `Client limit reached (${currentCount}/${maxClientsAllowed}) for your current plan (${plan?.name || "Subscription Plan"}). Please upgrade your plan to add more client organizations.`
              },
              HttpStatusCodes.FORBIDDEN
            );
          }
        }
      }
    }

    // Check Settings for BIN Uniqueness enforcement
    const settings = (await db.select().from(companySettings).limit(1))[0];
    const enforceBin = settings?.binUniqueEnforcement ?? true;

    if (trimmedBin && enforceBin) {
      const existingBin = (
        await db.select({ id: clients.id }).from(clients).where(eq(clients.binNumber, trimmedBin)).limit(1)
      )[0];
      if (existingBin) {
        return c.json({ message: `BIN number "${trimmedBin}" is already registered` }, HttpStatusCodes.CONFLICT);
      }
    }

    const inserted = (
      await db
        .insert(clients)
        .values({
          companyName: body.companyName.trim(),
          proprietorName: body.proprietorName?.trim() || null,
          mobile: body.mobile?.trim() || null,
          alternativeMobile: body.alternativeMobile?.trim() || null,
          email: body.email?.trim() || null,
          address: body.address?.trim() || null,
          binNumber: trimmedBin || null,
          tinNumber: body.tinNumber?.trim() || null,
          tradeLicenseNo: body.tradeLicenseNo?.trim() || null,
          customerTypeId: body.customerTypeId || null,
          referenceId: body.referenceId || null,
          vatUserId: body.vatUserId?.trim() || null,
          vatPassword: body.vatPassword || null,
          vatServiceType: body.vatServiceType || "FULL",
          openingBalance: body.openingBalance !== undefined ? Number(body.openingBalance) : 0,
          isActive: body.isActive ?? true,
          notes: body.notes?.trim() || null
        })
        .returning()
    )[0];

    // Assign Managers if provided
    if (body.managerIds && Array.isArray(body.managerIds) && body.managerIds.length > 0) {
      await db.insert(clientManagers).values(
        body.managerIds.map((mgrId: number) => ({
          clientId: inserted.id,
          managerId: mgrId
        }))
      );
    }

    return c.json({ message: "Client created successfully", data: inserted }, HttpStatusCodes.CREATED);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to create client" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 4. UPDATE CLIENT ─────────────────────────────────────────────────

export const updateClient: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = (await db.select().from(clients).where(eq(clients.id, id)).limit(1))[0];
    if (!existing) {
      return c.json({ message: "Client not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const trimmedBin = body.binNumber?.trim();
    if (trimmedBin) {
      const duplicateBin = (
        await db
          .select({ id: clients.id })
          .from(clients)
          .where(and(eq(clients.binNumber, trimmedBin), ne(clients.id, id)))
          .limit(1)
      )[0];
      if (duplicateBin) {
        return c.json({ message: `BIN number "${trimmedBin}" is already used by another client` }, HttpStatusCodes.CONFLICT);
      }
    }

    const updated = (
      await db
        .update(clients)
        .set({
          companyName: body.companyName !== undefined ? body.companyName.trim() : undefined,
          proprietorName: body.proprietorName !== undefined ? (body.proprietorName ? body.proprietorName.trim() : null) : undefined,
          mobile: body.mobile !== undefined ? (body.mobile ? body.mobile.trim() : null) : undefined,
          alternativeMobile: body.alternativeMobile !== undefined ? (body.alternativeMobile ? body.alternativeMobile.trim() : null) : undefined,
          email: body.email !== undefined ? (body.email ? body.email.trim() : null) : undefined,
          address: body.address !== undefined ? (body.address ? body.address.trim() : null) : undefined,
          binNumber: body.binNumber !== undefined ? (trimmedBin || null) : undefined,
          tinNumber: body.tinNumber !== undefined ? (body.tinNumber ? body.tinNumber.trim() : null) : undefined,
          tradeLicenseNo: body.tradeLicenseNo !== undefined ? (body.tradeLicenseNo ? body.tradeLicenseNo.trim() : null) : undefined,
          customerTypeId: body.customerTypeId !== undefined ? body.customerTypeId : undefined,
          referenceId: body.referenceId !== undefined ? body.referenceId : undefined,
          vatUserId: body.vatUserId !== undefined ? (body.vatUserId ? body.vatUserId.trim() : null) : undefined,
          vatPassword: body.vatPassword !== undefined ? body.vatPassword : undefined,
          vatServiceType: body.vatServiceType !== undefined ? body.vatServiceType : undefined,
          openingBalance: body.openingBalance !== undefined ? Number(body.openingBalance) : undefined,
          isActive: body.isActive !== undefined ? body.isActive : undefined,
          notes: body.notes !== undefined ? (body.notes ? body.notes.trim() : null) : undefined,
          updatedAt: new Date()
        })
        .where(eq(clients.id, id))
        .returning()
    )[0];

    // Update manager assignments if passed
    if (body.managerIds !== undefined && Array.isArray(body.managerIds)) {
      await db.delete(clientManagers).where(eq(clientManagers.clientId, id));
      if (body.managerIds.length > 0) {
        await db.insert(clientManagers).values(
          body.managerIds.map((mgrId: number) => ({
            clientId: id,
            managerId: mgrId
          }))
        );
      }
    }

    return c.json({ message: "Client updated successfully", data: updated }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to update client" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 5. TOGGLE CLIENT ACTIVE STATUS ───────────────────────────────────

export const toggleClientStatus: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const { isActive } = c.req.valid("json");

    const existing = (await db.select().from(clients).where(eq(clients.id, id)).limit(1))[0];
    if (!existing) {
      return c.json({ message: "Client not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const updated = (
      await db
        .update(clients)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(clients.id, id))
        .returning()
    )[0];

    return c.json(
      {
        message: `Client ${isActive ? "activated" : "deactivated"} successfully`,
        data: updated
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to toggle client status" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 6. DELETE CLIENT ─────────────────────────────────────────────────

export const deleteClient: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const existing = (await db.select().from(clients).where(eq(clients.id, id)).limit(1))[0];
    if (!existing) {
      return c.json({ message: "Client not found" }, HttpStatusCodes.NOT_FOUND);
    }

    await db.delete(clients).where(eq(clients.id, id));
    return c.json({ message: "Client deleted successfully" }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to delete client" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 7. VALIDATION: BIN UNIQUENESS CHECK ──────────────────────────────

export const checkBinUnique: Handler = async (c: any) => {
  try {
    const { bin, excludeId } = c.req.valid("json");
    const conditions = [eq(clients.binNumber, bin.trim())];
    if (excludeId) {
      conditions.push(ne(clients.id, excludeId));
    }

    const existing = (
      await db
        .select({ id: clients.id, companyName: clients.companyName })
        .from(clients)
        .where(and(...conditions))
        .limit(1)
    )[0];

    return c.json(
      {
        unique: !existing,
        existingClient: existing || null
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to check BIN" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 8. VALIDATION: CHECK MOBILE DUPLICATE ─────────────────────────────

export const checkMobileExists: Handler = async (c: any) => {
  try {
    const { mobile, excludeId } = c.req.valid("json");
    const conditions = [eq(clients.mobile, mobile.trim())];
    if (excludeId) {
      conditions.push(ne(clients.id, excludeId));
    }

    const matches = await db
      .select({ id: clients.id, companyName: clients.companyName, mobile: clients.mobile })
      .from(clients)
      .where(and(...conditions))
      .limit(3);

    return c.json({ matches }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to check mobile" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 9. ASSIGNMENTS: LIST CLIENT ASSIGNMENTS ──────────────────────────

export const listAssignments: Handler = async (c: any) => {
  try {
    const query = c.req.valid("query");
    const filter = query.filter || "all";

    const allClients = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        binNumber: clients.binNumber,
        mobile: clients.mobile,
        customerTypeId: clients.customerTypeId,
        customerTypeName: customerTypes.typeName,
        referenceId: clients.referenceId,
        referenceName: clientReferences.name,
        isActive: clients.isActive
      })
      .from(clients)
      .leftJoin(customerTypes, eq(clients.customerTypeId, customerTypes.id))
      .leftJoin(clientReferences, eq(clients.referenceId, clientReferences.id))
      .orderBy(asc(clients.companyName));

    const allManagers = await db
      .select({
        clientId: clientManagers.clientId,
        managerId: clientManagers.managerId,
        managerName: users.name,
        managerEmail: users.email
      })
      .from(clientManagers)
      .innerJoin(users, eq(clientManagers.managerId, users.id));

    const managerMap: Record<number, any[]> = {};
    for (const m of allManagers) {
      if (!managerMap[m.clientId]) {
        managerMap[m.clientId] = [];
      }
      managerMap[m.clientId].push({
        id: m.managerId,
        name: m.managerName,
        email: m.managerEmail
      });
    }

    let result = allClients.map((cl) => {
      const mgrs = managerMap[cl.id] || [];
      return {
        ...cl,
        managerIds: mgrs.map((m) => m.id),
        managers: mgrs
      };
    });

    if (query.search && query.search.trim()) {
      const term = query.search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.companyName.toLowerCase().includes(term) ||
          (r.binNumber && r.binNumber.toLowerCase().includes(term)) ||
          (r.mobile && r.mobile.toLowerCase().includes(term))
      );
    }

    if (filter === "assigned") {
      result = result.filter((r) => r.managerIds.length > 0);
    } else if (filter === "shared") {
      result = result.filter((r) => r.managerIds.length > 1);
    } else if (filter === "unassigned") {
      result = result.filter((r) => r.managerIds.length === 0);
    }

    return c.json({ message: "Assignments fetched", data: result }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to list assignments" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 10. ASSIGNMENTS: SAVE ASSIGNMENTS FOR A CLIENT ───────────────────

export const assignManagers: Handler = async (c: any) => {
  try {
    const { clientId, managerIds } = c.req.valid("json");

    const existingClient = (await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1))[0];
    if (!existingClient) {
      return c.json({ message: "Client not found" }, HttpStatusCodes.NOT_FOUND);
    }

    await db.delete(clientManagers).where(eq(clientManagers.clientId, clientId));

    if (managerIds.length > 0) {
      await db.insert(clientManagers).values(
        managerIds.map((mgrId: number) => ({
          clientId,
          managerId: mgrId
        }))
      );
    }

    return c.json({ message: "Manager assignments updated successfully" }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to assign managers" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 11. LIST ASSIGNABLE USERS ────────────────────────────────────────

export const listAssignableUsers: Handler = async (c: any) => {
  try {
    const auth = c.get("auth") || c.get("user");
    let tenantAdminId: number | null = null;
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

    const adminRoles = await db
      .select({ id: roles.id })
      .from(roles)
      .where(or(eq(roles.name, "admin"), eq(roles.name, "superadmin")));

    const excludeRoleIds = adminRoles.map((r) => r.id);

    const conditions: any[] = [
      eq(users.status, "active")
    ];

    if (excludeRoleIds.length > 0) {
      conditions.push(sql`${users.roleId} NOT IN (${sql.join(excludeRoleIds, sql`, `)})`);
    }

    if (tenantAdminId && !isSuperAdmin) {
      conditions.push(eq(users.adminId, tenantAdminId));
      conditions.push(ne(users.id, tenantAdminId));
    }

    const list = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(asc(users.name));

    return c.json({ message: "Users fetched", data: list }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to fetch users" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── 12. BULK CREATE CLIENTS ──────────────────────────────────────────

export const bulkCreateClients: Handler = async (c: any) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const rawClients = Array.isArray(body?.clients) ? body.clients : [];
    if (rawClients.length === 0) {
      return c.json({ message: "No clients provided", createdCount: 0 }, HttpStatusCodes.BAD_REQUEST);
    }

    const auth = c.get("auth") || c.get("user");
    let tenantAdminId = 1;
    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(auth.id))
      });
      if (currentUser) {
        tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;
      }
    }

    const allTypes = await db.select().from(customerTypes);
    const allRefs = await db.select().from(clientReferences);

    const insertedList: any[] = [];
    let skippedCount = 0;

    for (const item of rawClients) {
      const companyName = item.companyName?.trim() || item.name?.trim();
      if (!companyName) {
        skippedCount++;
        continue;
      }

      // Customer Type Matching
      let resolvedTypeId: number | null = null;
      if (item.customerTypeId && !isNaN(Number(item.customerTypeId))) {
        resolvedTypeId = Number(item.customerTypeId);
      } else if (item.customerType || item.customerTypeName) {
        const typeStr = String(item.customerType || item.customerTypeName).trim().toLowerCase();
        const found = allTypes.find((t) => t.typeName.toLowerCase() === typeStr || t.typeName.toLowerCase().includes(typeStr));
        if (found) resolvedTypeId = found.id;
      }

      // Reference Matching
      let resolvedRefId: number | null = null;
      if (item.referenceId && !isNaN(Number(item.referenceId))) {
        resolvedRefId = Number(item.referenceId);
      } else if (item.reference || item.referenceName) {
        const refStr = String(item.reference || item.referenceName).trim().toLowerCase();
        const found = allRefs.find((r) => r.name.toLowerCase() === refStr || r.name.toLowerCase().includes(refStr));
        if (found) resolvedRefId = found.id;
      }

      // VAT Service Type Resolution
      let serviceType = "FULL";
      if (item.vatServiceType) {
        const st = String(item.vatServiceType).trim().toUpperCase();
        if (st.includes("ONLY") || st.includes("RETURN")) {
          serviceType = "ONLY_RETURN";
        }
      }

      // Status
      let active = true;
      if (item.isActive !== undefined) {
        if (typeof item.isActive === "boolean") {
          active = item.isActive;
        } else {
          const str = String(item.isActive).trim().toLowerCase();
          if (str === "false" || str === "inactive" || str === "no" || str === "0") {
            active = false;
          }
        }
      }

      // Opening Balance (Due > 0, Advance < 0)
      let openingBalance = 0;
      const rawBal = item.openingBalance !== undefined ? item.openingBalance : item.previousDue !== undefined ? item.previousDue : item["Previous Due"] !== undefined ? item["Previous Due"] : item["Opening Balance"];
      const balType = String(item.balanceType || item.openingType || item["Balance Type"] || "").toLowerCase().trim();
      
      if (rawBal !== undefined && rawBal !== null && !isNaN(Number(rawBal))) {
        const num = Number(rawBal);
        if (balType.includes("adv") || balType.includes("credit")) {
          openingBalance = -Math.abs(num);
        } else {
          openingBalance = num;
        }
      }

      const clientData = {
        companyName,
        proprietorName: item.proprietorName?.trim() || null,
        mobile: item.mobile?.trim() || null,
        alternativeMobile: item.alternativeMobile?.trim() || null,
        email: item.email?.trim() || null,
        address: item.address?.trim() || null,
        binNumber: item.binNumber?.trim() || item.bin?.trim() || null,
        tinNumber: item.tinNumber?.trim() || item.tin?.trim() || null,
        tradeLicenseNo: item.tradeLicenseNo?.trim() || null,
        customerTypeId: resolvedTypeId,
        referenceId: resolvedRefId,
        vatUserId: item.vatUserId?.trim() || null,
        vatPassword: item.vatPassword?.trim() || null,
        vatServiceType: serviceType,
        openingBalance: openingBalance,
        isActive: active,
        createdBy: tenantAdminId,
        notes: item.notes?.trim() || null
      };

      try {
        const [newClient] = await db.insert(clients).values(clientData).returning();
        if (newClient) {
          insertedList.push(newClient);
        }
      } catch (e) {
        skippedCount++;
      }
    }

    return c.json(
      {
        message: `Successfully uploaded ${insertedList.length} clients${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}`,
        createdCount: insertedList.length,
        skippedCount
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to bulk upload clients" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// ── GET CLIENT PURCHASED ITEMS ───────────────────────────────────────
export const getClientPurchasedItems: Handler = async (c: any) => {
  try {
    const clientId = Number(c.req.param("id"));
    if (!clientId || isNaN(clientId)) {
      return c.json({ message: "Invalid client ID", data: [] }, HttpStatusCodes.BAD_REQUEST);
    }

    const pQuery = await db
      .select({
        id: globalItems.id,
        name: globalItems.name,
        hsCode: globalItems.hsCode,
        unit: globalItems.unit
      })
      .from(purchases)
      .innerJoin(globalItems, eq(purchases.itemId, globalItems.id))
      .where(eq(purchases.clientId, clientId));

    // Deduplicate items by id
    const uniqueItemsMap = new Map<number, any>();
    for (const item of pQuery) {
      if (!uniqueItemsMap.has(item.id)) {
        uniqueItemsMap.set(item.id, item);
      }
    }

    const data = Array.from(uniqueItemsMap.values());
    return c.json({ message: "Client purchased items fetched successfully", data }, HttpStatusCodes.OK);
  } catch (err: any) {
    console.error("Error fetching client purchased items:", err);
    return c.json({ message: err.message || "Failed to fetch client purchased items", data: [] }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

