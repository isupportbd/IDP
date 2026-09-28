import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Handler } from "hono";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { purchases } from "@/modules/clients/database/models/purchases.js";
import { vatSubmissions } from "@/modules/clients/database/models/vat_submissions.js";
import { customerTypes } from "@/modules/services/database/models/customer_types.js";
import { clientReferences } from "@/modules/services/database/models/references.js";
import { users } from "@/modules/auth/database/models/user.js";

/**
 * Get Activity Matrix & Client Data for the Activity Filter Module
 */
export const getActivityMatrix: Handler = async (c: any) => {
  try {
    const query = c.req.valid("query");

    // Determine target month (tax period) - default to previous month
    let taxPeriod = query.month || query.taxPeriod;
    if (!taxPeriod) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      taxPeriod = `${year}-${month}`;
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

    // 1. Fetch all active clients
    const activeClients = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        proprietorName: clients.proprietorName,
        binNumber: clients.binNumber,
        tinNumber: clients.tinNumber,
        mobile: clients.mobile,
        alternativeMobile: clients.alternativeMobile,
        email: clients.email,
        address: clients.address,
        vatUserId: clients.vatUserId,
        vatPassword: clients.vatPassword,
        vatServiceType: clients.vatServiceType,
        customerTypeId: clients.customerTypeId,
        customerTypeName: customerTypes.typeName,
        referenceId: clients.referenceId,
        referenceName: clientReferences.name,
        isActive: clients.isActive
      })
      .from(clients)
      .leftJoin(customerTypes, eq(clients.customerTypeId, customerTypes.id))
      .leftJoin(clientReferences, eq(clients.referenceId, clientReferences.id))
      .where(eq(clients.isActive, true))
      .orderBy(asc(clients.companyName));

    const activeClientIds = activeClients.map((cl) => cl.id);

    // 2. Fetch submissions for this month
    let submissionsMap: Record<number, any> = {};
    if (activeClientIds.length > 0) {
      const existingSubmissions = await db
        .select({
          id: vatSubmissions.id,
          clientId: vatSubmissions.clientId,
          submissionId: vatSubmissions.submissionId,
          status: vatSubmissions.status,
          submittedAt: vatSubmissions.submittedAt,
          submittedBy: vatSubmissions.submittedBy,
          submitterName: users.name,
          remarks: vatSubmissions.remarks
        })
        .from(vatSubmissions)
        .leftJoin(users, eq(vatSubmissions.submittedBy, users.id))
        .where(
          and(
            inArray(vatSubmissions.clientId, activeClientIds),
            eq(vatSubmissions.taxPeriod, taxPeriod)
          )
        );

      existingSubmissions.forEach((sub) => {
        submissionsMap[sub.clientId] = sub;
      });
    }

    // 3. Fetch purchase totals per client for this month
    let purchasesMap: Record<number, { totalBaseValue: number; beCount: number }> = {};
    if (activeClientIds.length > 0) {
      const clientPurchases = await db
        .select({
          clientId: purchases.clientId,
          totalBaseValue: sql<number>`COALESCE(SUM(${purchases.baseValueOfVat}), 0)`,
          beCount: sql<number>`COUNT(DISTINCT COALESCE(NULLIF(${purchases.beNo}, ''), ${purchases.id}::text))`
        })
        .from(purchases)
        .where(
          and(
            inArray(purchases.clientId, activeClientIds),
            eq(purchases.month, taxPeriod),
            isSuperAdmin ? undefined : eq(purchases.adminId, tenantAdminId)
          )
        )
        .groupBy(purchases.clientId);

      clientPurchases.forEach((p) => {
        purchasesMap[p.clientId] = {
          totalBaseValue: Number(p.totalBaseValue) || 0,
          beCount: Number(p.beCount) || 0
        };
      });
    }

    // 4. Build Client Matrix Records
    const matrixClients = activeClients.map((client) => {
      const submission = submissionsMap[client.id] || null;
      const isSubmitted = Boolean(submission?.submissionId);
      const purchaseInfo = purchasesMap[client.id] || { totalBaseValue: 0, beCount: 0 };
      const purchaseAmount = purchaseInfo.totalBaseValue;
      const beCount = purchaseInfo.beCount;

      return {
        id: client.id,
        name: client.companyName,
        companyName: client.companyName,
        proprietorName: client.proprietorName,
        bin: client.binNumber,
        binNumber: client.binNumber,
        tinNumber: client.tinNumber,
        mobile: client.mobile,
        username: client.vatUserId,
        password: client.vatPassword,
        clientTypeId: client.customerTypeId,
        clientType: client.customerTypeName || "Standard",
        referenceId: client.referenceId,
        reference: client.referenceName || "Direct Acquisition",
        taxPeriod: taxPeriod,
        purchaseAmount: purchaseAmount,
        beCount: beCount,
        isSubmitted: isSubmitted,
        submission: submission
          ? {
              submissionId: submission.submissionId,
              status: submission.status,
              submittedAt: submission.submittedAt,
              submittedBy: submission.submitterName || "System Staff",
              remarks: submission.remarks
            }
          : null
      };
    });

    // 4. Calculate Summary Statistics
    const totalClients = matrixClients.length;
    const activeCount = matrixClients.filter((c) => c.purchaseAmount > 0).length;
    const activeFiledCount = matrixClients.filter((c) => c.purchaseAmount > 0 && c.isSubmitted).length;
    const activeUnfiledCount = matrixClients.filter((c) => c.purchaseAmount > 0 && !c.isSubmitted).length;
    
    const inactiveCount = matrixClients.filter((c) => c.purchaseAmount === 0).length;
    const inactiveFiledCount = matrixClients.filter((c) => c.purchaseAmount === 0 && c.isSubmitted).length;
    const inactiveUnfiledCount = matrixClients.filter((c) => c.purchaseAmount === 0 && !c.isSubmitted).length;

    const totalFiledCount = matrixClients.filter((c) => c.isSubmitted).length;
    const totalUnfiledCount = matrixClients.filter((c) => !c.isSubmitted).length;
    const totalPurchaseSum = matrixClients.reduce((acc, c) => acc + (c.purchaseAmount || 0), 0);
    const totalBeCount = matrixClients.reduce((acc, c) => acc + (c.beCount || 0), 0);

    // 5. Fetch Client Types & References for filter dropdowns
    const allTypes = await db
      .select({ id: customerTypes.id, name: customerTypes.typeName })
      .from(customerTypes)
      .where(eq(customerTypes.isActive, true))
      .orderBy(asc(customerTypes.typeName));

    const allRefs = await db
      .select({ id: clientReferences.id, name: clientReferences.name })
      .from(clientReferences)
      .where(eq(clientReferences.isActive, true))
      .orderBy(asc(clientReferences.name));

    return c.json(
      {
        success: true,
        message: "Activity matrix loaded successfully",
        taxPeriod: taxPeriod,
        data: matrixClients,
        stats: {
          totalClients,
          activeClients: activeCount,
          activeFiledClients: activeFiledCount,
          activeUnfiledClients: activeUnfiledCount,
          inactiveClients: inactiveCount,
          inactiveFiledClients: inactiveFiledCount,
          inactiveUnfiledClients: inactiveUnfiledCount,
          totalFiledClients: totalFiledCount,
          totalUnfiledClients: totalUnfiledCount,
          totalPurchaseSum,
          totalBeCount
        },
        clientTypes: allTypes,
        references: allRefs
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.error("Activity Matrix Error:", error);
    return c.json(
      {
        success: false,
        message: error.message || "Failed to load activity matrix"
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
