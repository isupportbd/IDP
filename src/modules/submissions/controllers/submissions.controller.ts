import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Handler } from "hono";
import { db, getDefaultTaxPeriod, getSubmissionDeadline, HttpStatusCodes, resolveTenantContext } from "@/framework/facade.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { clientManagers } from "@/modules/clients/database/models/client_managers.js";
import { vatSubmissions } from "@/modules/clients/database/models/vat_submissions.js";
import { customerTypes } from "@/modules/services/database/models/customer_types.js";
import { clientReferences } from "@/modules/services/database/models/references.js";
import { users } from "@/modules/auth/database/models/user.js";
import { sendVatSubmissionSms } from "@/modules/sms-templates/services/sms.service.js";

// ── 1. LIST SUBMISSIONS FOR A TAX PERIOD ──────────────────────────────

export const listSubmissions: Handler = async (c: any) => {
  try {
    const query = c.req.valid("query");
    const taxPeriod = getDefaultTaxPeriod(query.month || query.taxPeriod);
    const deadline = getSubmissionDeadline(taxPeriod);

    const { isSuperAdmin, tenantAdminId } = await resolveTenantContext(c);

    const clientConditions: any[] = [eq(clients.isActive, true)];
    if (!isSuperAdmin && tenantAdminId) {
      clientConditions.push(eq(clients.createdBy, tenantAdminId));
    }

    // 1. Fetch all ACTIVE clients only
    const activeClients = await db
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
      .where(and(...clientConditions))
      .orderBy(asc(clients.companyName));

    const activeClientIds = activeClients.map((cl) => cl.id);

    // If no active clients, return empty data
    if (activeClientIds.length === 0) {
      return c.json(
        {
          message: "No active clients found",
          data: [],
          stats: {
            totalActive: 0,
            submittedCount: 0,
            pendingCount: 0,
            lateSubmittedCount: 0
          }
        },
        HttpStatusCodes.OK
      );
    }

    // 2. Fetch existing vat_submissions for this tax period
    const existingSubmissions = await db
      .select({
        id: vatSubmissions.id,
        clientId: vatSubmissions.clientId,
        taxPeriod: vatSubmissions.taxPeriod,
        submissionId: vatSubmissions.submissionId,
        status: vatSubmissions.status,
        submittedBy: vatSubmissions.submittedBy,
        submittedByName: users.name,
        submittedAt: vatSubmissions.submittedAt,
        remarks: vatSubmissions.remarks
      })
      .from(vatSubmissions)
      .leftJoin(users, eq(vatSubmissions.submittedBy, users.id))
      .where(
        and(
          eq(vatSubmissions.taxPeriod, taxPeriod),
          inArray(vatSubmissions.clientId, activeClientIds)
        )
      );

    const submissionMap: Record<number, (typeof existingSubmissions)[0]> = {};
    for (const sub of existingSubmissions) {
      submissionMap[sub.clientId] = sub;
    }

    // 3. Fetch assigned managers for active clients
    const allManagers = await db
      .select({
        clientId: clientManagers.clientId,
        managerId: clientManagers.managerId,
        managerName: users.name
      })
      .from(clientManagers)
      .innerJoin(users, eq(clientManagers.managerId, users.id))
      .where(inArray(clientManagers.clientId, activeClientIds));

    const managersMap: Record<number, Array<{ id: number; name: string }>> = {};
    for (const m of allManagers) {
      if (!managersMap[m.clientId]) {
        managersMap[m.clientId] = [];
      }
      managersMap[m.clientId].push({ id: m.managerId, name: m.managerName });
    }

    // 4. Build combined list with computed status
    let list = activeClients.map((client) => {
      const sub = submissionMap[client.id];
      const assignedManagers = managersMap[client.id] || [];

      let status: "submitted" | "pending" | "late_submitted" = "pending";
      let submissionRecordId: number | null = null;
      let submissionId: string | null = null;
      let submittedAt: string | null = null;
      let remarks: string | null = null;
      let submittedById: number | null = null;
      let submittedByName: string | null = null;

      if (sub) {
        submissionRecordId = sub.id;
        submissionId = sub.submissionId;
        submittedAt = sub.submittedAt ? new Date(sub.submittedAt).toISOString() : null;
        remarks = sub.remarks;
        submittedById = sub.submittedBy;
        submittedByName = sub.submittedByName;

        const submitDate = new Date(sub.submittedAt);
        if (sub.status === "late_submitted" || submitDate > deadline) {
          status = "late_submitted";
        } else {
          status = "submitted";
        }
      }

      return {
        id: client.id, // Client ID
        submissionRecordId, // vat_submissions.id (null if pending)
        companyName: client.companyName,
        binNumber: client.binNumber,
        mobile: client.mobile,
        customerTypeId: client.customerTypeId,
        customerTypeName: client.customerTypeName,
        referenceId: client.referenceId,
        referenceName: client.referenceName,
        taxPeriod,
        submissionId,
        status,
        submittedById,
        submittedByName,
        submittedAt,
        remarks,
        managers: assignedManagers
      };
    });

    // 5. Calculate statistics before client-side visual filters
    const stats = {
      totalActive: list.length,
      submittedCount: list.filter((r) => r.status === "submitted").length,
      pendingCount: list.filter((r) => r.status === "pending").length,
      lateSubmittedCount: list.filter((r) => r.status === "late_submitted").length
    };

    // 6. Apply filters
    if (query.status && query.status !== "all") {
      list = list.filter((r) => r.status === query.status);
    }

    if (query.customerTypeId && query.customerTypeId !== "all") {
      const typeId = Number(query.customerTypeId);
      list = list.filter((r) => r.customerTypeId === typeId);
    }

    if (query.referenceId && query.referenceId !== "all") {
      const refId = Number(query.referenceId);
      list = list.filter((r) => r.referenceId === refId);
    }

    if (query.managerId && query.managerId !== "all") {
      const mgrId = Number(query.managerId);
      list = list.filter((r) => r.managers.some((m) => m.id === mgrId));
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.companyName.toLowerCase().includes(q) ||
          (r.binNumber && r.binNumber.toLowerCase().includes(q)) ||
          (r.submissionId && r.submissionId.toLowerCase().includes(q)) ||
          (r.remarks && r.remarks.toLowerCase().includes(q))
      );
    }

    return c.json(
      {
        message: "Submissions fetched successfully",
        data: list,
        stats
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to fetch submissions" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 2. RECORD / UPSERT SUBMISSION ID ─────────────────────────────────

export const recordSubmission: Handler = async (c: any) => {
  try {
    const payload = c.req.valid("json");
    const { clientId, taxPeriod, submissionId, remarks } = payload;

    // Verify active client
    const client = (
      await db
        .select({
          id: clients.id,
          companyName: clients.companyName,
          mobile: clients.mobile,
          alternativeMobile: clients.alternativeMobile,
          binNumber: clients.binNumber,
          createdBy: clients.createdBy,
          isActive: clients.isActive
        })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1)
    )[0];

    if (!client) {
      return c.json({ message: "Client not found" }, HttpStatusCodes.NOT_FOUND);
    }

    // Automatically resolve client manager from client_managers
    let managerId: number | null = payload.submittedBy || null;
    if (!managerId) {
      const assignedManager = (
        await db
          .select({ managerId: clientManagers.managerId })
          .from(clientManagers)
          .where(eq(clientManagers.clientId, clientId))
          .limit(1)
      )[0];
      if (assignedManager) {
        managerId = assignedManager.managerId;
      }
    }

    const submittedAt = payload.submittedAt ? new Date(payload.submittedAt) : new Date();
    const deadline = getSubmissionDeadline(taxPeriod);
    const status = submittedAt > deadline ? "late_submitted" : "submitted";

    // Check if record already exists for this client and tax period
    const existing = (
      await db
        .select({ id: vatSubmissions.id })
        .from(vatSubmissions)
        .where(
          and(
            eq(vatSubmissions.clientId, clientId),
            eq(vatSubmissions.taxPeriod, taxPeriod)
          )
        )
        .limit(1)
    )[0];

    let result: any = null;
    if (existing) {
      result = (
        await db
          .update(vatSubmissions)
          .set({
            submissionId: submissionId.trim(),
            status,
            submittedBy: managerId,
            submittedAt,
            remarks: remarks?.trim() || null,
            updatedAt: new Date()
          })
          .where(eq(vatSubmissions.id, existing.id))
          .returning()
      )[0];
    } else {
      result = (
        await db
          .insert(vatSubmissions)
          .values({
            clientId,
            taxPeriod,
            submissionId: submissionId.trim(),
            status,
            submittedBy: managerId,
            submittedAt,
            remarks: remarks?.trim() || null
          })
          .returning()
      )[0];
    }

    // Trigger automated SMS in background (non-blocking)
    // Use client.createdBy as the authoritative adminId for gateway lookup.
    // Fall back to the authenticated user's tenant admin. Never fall back to 1.
    const user = c.get("auth") || c.get("user") || (c.req as any).user;
    const adminId: number | null = client.createdBy
      || (user?.adminId ? Number(user.adminId) : null)
      || (user?.id ? Number(user.id) : null)
      || null;

    if (adminId) {
      sendVatSubmissionSms({
        clientName: client.companyName,
        clientMobile: client.mobile,
        clientAltMobile: client.alternativeMobile,
        clientBin: client.binNumber,
        taxPeriod,
        submissionId: submissionId.trim(),
        adminId,
        sentByUserId: user?.id ?? null
      }).catch((smsErr) => {
        console.warn("[Submission Auto-SMS Warning]:", smsErr?.message || smsErr);
      });
    }

    return c.json(
      {
        message: "Submission ID recorded successfully",
        data: result
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to record submission" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 3. DELETE SUBMISSION RECORD ──────────────────────────────────────

export const deleteSubmission: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const existing = (
      await db
        .select({ id: vatSubmissions.id })
        .from(vatSubmissions)
        .where(eq(vatSubmissions.id, id))
        .limit(1)
    )[0];

    if (!existing) {
      return c.json({ message: "Submission record not found" }, HttpStatusCodes.NOT_FOUND);
    }

    await db.delete(vatSubmissions).where(eq(vatSubmissions.id, id));

    return c.json({ message: "Submission record deleted successfully" }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to delete submission" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 4. BATCH DELETE SUBMISSIONS ──────────────────────────────────────

export const batchDeleteSubmissions: Handler = async (c: any) => {
  try {
    const { ids } = c.req.valid("json");
    if (!ids || ids.length === 0) {
      return c.json({ message: "No submission IDs provided" }, HttpStatusCodes.BAD_REQUEST);
    }

    await db.delete(vatSubmissions).where(inArray(vatSubmissions.id, ids));

    return c.json({ message: `${ids.length} submission records deleted` }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to batch delete submissions" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
