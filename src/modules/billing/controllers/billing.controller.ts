import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import type { Handler } from "hono";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { bills } from "../database/models/bills.js";
import { billItems } from "../database/models/bill_items.js";
import { collections } from "../database/models/collections.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { vatSubmissions } from "@/modules/clients/database/models/vat_submissions.js";
import { serviceItems } from "@/modules/services/database/models/service_items.js";
import { serviceRates } from "@/modules/services/database/models/service_rates.js";
import { customerTypes } from "@/modules/services/database/models/customer_types.js";
import { clientReferences } from "@/modules/services/database/models/references.js";
import { clientManagers } from "@/modules/clients/database/models/client_managers.js";
import { users } from "@/modules/auth/database/models/user.js";

// Helper: Round to 2 decimal places
function r2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// ── 1. SEQUENCE GENERATORS ──────────────────────────────────────────

/**
 * Generates sequential Invoice No in format: Inv-YYYY-000001
 */
async function generateNextBillNo(year: number): Promise<string> {
  const prefix = `Inv-${year}-`;
  const latestBill = (
    await db
      .select({ billNo: bills.billNo })
      .from(bills)
      .where(like(bills.billNo, `${prefix}%`))
      .orderBy(desc(bills.id))
      .limit(1)
  )[0];

  let nextSeq = 1;
  if (latestBill && latestBill.billNo) {
    const parts = latestBill.billNo.split("-");
    if (parts.length >= 3) {
      const numPart = parseInt(parts[2], 10);
      if (!isNaN(numPart)) {
        nextSeq = numPart + 1;
      }
    }
  }

  const padded = String(nextSeq).padStart(6, "0");
  return `${prefix}${padded}`;
}

/**
 * Generates sequential Money Receipt No in format: MR-YYYY-000001
 */
async function generateNextReceiptNo(year: number): Promise<string> {
  const prefix = `MR-${year}-`;
  const latestCol = (
    await db
      .select({ receiptNo: collections.receiptNo })
      .from(collections)
      .where(like(collections.receiptNo, `${prefix}%`))
      .orderBy(desc(collections.id))
      .limit(1)
  )[0];

  let nextSeq = 1;
  if (latestCol && latestCol.receiptNo) {
    const parts = latestCol.receiptNo.split("-");
    if (parts.length >= 3) {
      const numPart = parseInt(parts[2], 10);
      if (!isNaN(numPart)) {
        nextSeq = numPart + 1;
      }
    }
  }

  const padded = String(nextSeq).padStart(6, "0");
  return `${prefix}${padded}`;
}

// ── 2. RUNNING BALANCE & LEDGER HELPER ───────────────────────────────

/**
 * Calculates client's running balance (positive = due, negative = advance)
 */
async function getClientRunningDue(clientId: number, excludeBillId?: number): Promise<number> {
  // Fetch Client's Opening Balance
  const clientRow = (
    await db
      .select({ openingBalance: clients.openingBalance })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1)
  )[0];
  const openingBalance = clientRow?.openingBalance || 0;

  // Sum of finalized/active bills (grandTotal - paidAmount)
  const clientBills = await db
    .select({
      id: bills.id,
      subtotal: bills.subtotal,
      discountAmount: bills.discountAmount,
      paidAmount: bills.paidAmount,
      status: bills.status
    })
    .from(bills)
    .where(
      and(
        eq(bills.clientId, clientId),
        sql`${bills.status} != 'cancelled'`
      )
    );

  let totalBilledNet = openingBalance;
  for (const b of clientBills) {
    if (excludeBillId && b.id === excludeBillId) continue;
    totalBilledNet += (b.subtotal - b.discountAmount);
  }

  // Sum of completed collections
  const clientCollections = await db
    .select({
      amount: collections.amount,
      status: collections.status
    })
    .from(collections)
    .where(
      and(
        eq(collections.clientId, clientId),
        eq(collections.status, "completed")
      )
    );

  let totalCollected = 0;
  for (const c of clientCollections) {
    totalCollected += c.amount;
  }

  const netDue = r2(totalBilledNet - totalCollected);
  return netDue > 0 ? netDue : 0;
}

// ── 3. LIST INVOICES / BILLS ─────────────────────────────────────────

export const listBills: Handler = async (c: any) => {
  try {
    const query = c.req.valid("query");
    const month = query.month || query.taxPeriod;

    let conditions: any[] = [];
    if (month && month !== "all") {
      conditions.push(eq(bills.taxPeriod, month));
    }
    if (query.clientId && query.clientId !== "all") {
      conditions.push(eq(bills.clientId, Number(query.clientId)));
    }
    if (query.status && query.status !== "all") {
      conditions.push(eq(bills.status, query.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: bills.id,
        billNo: bills.billNo,
        clientId: bills.clientId,
        clientName: clients.companyName,
        clientBin: clients.binNumber,
        customerTypeId: clients.customerTypeId,
        customerTypeName: customerTypes.typeName,
        referenceId: clients.referenceId,
        referenceName: clientReferences.name,
        taxPeriod: bills.taxPeriod,
        billDate: bills.billDate,
        dueDate: bills.dueDate,
        subtotal: bills.subtotal,
        discountAmount: bills.discountAmount,
        previousDue: bills.previousDue,
        grandTotal: bills.grandTotal,
        paidAmount: bills.paidAmount,
        dueAmount: bills.dueAmount,
        status: bills.status,
        notes: bills.notes,
        createdById: bills.createdBy,
        createdByName: users.name,
        createdAt: bills.createdAt
      })
      .from(bills)
      .leftJoin(clients, eq(bills.clientId, clients.id))
      .leftJoin(customerTypes, eq(clients.customerTypeId, customerTypes.id))
      .leftJoin(clientReferences, eq(clients.referenceId, clientReferences.id))
      .leftJoin(users, eq(bills.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(bills.id));

    // Fetch line items for the bills
    const billIds = rows.map((r) => r.id);
    let itemsMap: Record<number, any[]> = {};
    if (billIds.length > 0) {
      const allItems = await db
        .select()
        .from(billItems)
        .where(inArray(billItems.billId, billIds));

      for (const it of allItems) {
        if (!itemsMap[it.billId]) itemsMap[it.billId] = [];
        itemsMap[it.billId].push(it);
      }
    }

    let list = rows.map((r) => ({
      ...r,
      items: itemsMap[r.id] || []
    }));

    // Client-side search filtering if provided
    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.billNo.toLowerCase().includes(q) ||
          r.clientName?.toLowerCase().includes(q) ||
          r.clientBin?.toLowerCase().includes(q) ||
          r.referenceName?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q)
      );
    }

    if (query.customerTypeId && query.customerTypeId !== "all") {
      const typeId = Number(query.customerTypeId);
      list = list.filter((r) => r.customerTypeId === typeId);
    }

    if (query.referenceId && query.referenceId !== "all") {
      const refId = Number(query.referenceId);
      list = list.filter((r) => r.referenceId === refId);
    }

    // Overall summary statistics
    const stats = {
      totalInvoicesCount: list.length,
      totalBilledAmount: r2(list.reduce((acc, b) => acc + (b.subtotal - b.discountAmount), 0)),
      totalPaidAmount: r2(list.reduce((acc, b) => acc + b.paidAmount, 0)),
      totalDueAmount: r2(list.reduce((acc, b) => acc + b.dueAmount, 0)),
      paidCount: list.filter((b) => b.status === "paid").length,
      unpaidCount: list.filter((b) => b.status === "unpaid").length,
      partialCount: list.filter((b) => b.status === "partial").length
    };

    return c.json(
      {
        message: "Bills fetched successfully",
        data: list,
        stats
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to fetch bills" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 4. GET BILL DETAILS ──────────────────────────────────────────────

export const getBillDetails: Handler = async (c: any) => {
  try {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ message: "Invalid bill ID" }, HttpStatusCodes.BAD_REQUEST);
    }

    const bill = (
      await db
        .select({
          id: bills.id,
          billNo: bills.billNo,
          clientId: bills.clientId,
          clientName: clients.companyName,
          clientBin: clients.binNumber,
          clientMobile: clients.mobile,
          clientAddress: clients.address,
          customerTypeName: customerTypes.typeName,
          referenceName: clientReferences.name,
          taxPeriod: bills.taxPeriod,
          billDate: bills.billDate,
          dueDate: bills.dueDate,
          subtotal: bills.subtotal,
          discountAmount: bills.discountAmount,
          previousDue: bills.previousDue,
          grandTotal: bills.grandTotal,
          paidAmount: bills.paidAmount,
          dueAmount: bills.dueAmount,
          status: bills.status,
          notes: bills.notes,
          createdAt: bills.createdAt
        })
        .from(bills)
        .leftJoin(clients, eq(bills.clientId, clients.id))
        .leftJoin(customerTypes, eq(clients.customerTypeId, customerTypes.id))
        .leftJoin(clientReferences, eq(clients.referenceId, clientReferences.id))
        .where(eq(bills.id, id))
        .limit(1)
    )[0];

    if (!bill) {
      return c.json({ message: "Bill not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const items = await db
      .select()
      .from(billItems)
      .where(eq(billItems.billId, id));

    const linkedCollections = await db
      .select()
      .from(collections)
      .where(eq(collections.billId, id));

    return c.json(
      {
        message: "Bill details fetched successfully",
        data: {
          ...bill,
          items,
          collections: linkedCollections
        }
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to fetch bill details" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 5. CLIENT BILLING OVERVIEW & AUTO-ITEMS HELPER ───────────────────

export const getClientBillingOverview: Handler = async (c: any) => {
  try {
    const query = c.req.valid("query");
    const clientId = Number(query.clientId);
    const targetMonth = query.month || new Date().toISOString().slice(0, 7);

    if (isNaN(clientId)) {
      return c.json({ message: "Client ID is required" }, HttpStatusCodes.BAD_REQUEST);
    }

    const client = (
      await db
        .select({
          id: clients.id,
          companyName: clients.companyName,
          binNumber: clients.binNumber,
          mobile: clients.mobile,
          address: clients.address,
          customerTypeId: clients.customerTypeId,
          customerTypeName: customerTypes.typeName,
          referenceId: clients.referenceId,
          referenceName: clientReferences.name,
          vatServiceType: clients.vatServiceType,
          isActive: clients.isActive
        })
        .from(clients)
        .leftJoin(customerTypes, eq(clients.customerTypeId, customerTypes.id))
        .leftJoin(clientReferences, eq(clients.referenceId, clientReferences.id))
        .where(eq(clients.id, clientId))
        .limit(1)
    )[0];

    if (!client) {
      return c.json({ message: "Client not found" }, HttpStatusCodes.NOT_FOUND);
    }

    // 1. Fetch all finalized submission months for this client
    const clientSubmissions = await db
      .select({
        taxPeriod: vatSubmissions.taxPeriod,
        submissionId: vatSubmissions.submissionId,
        status: vatSubmissions.status,
        submittedAt: vatSubmissions.submittedAt
      })
      .from(vatSubmissions)
      .where(
        and(
          eq(vatSubmissions.clientId, clientId),
          sql`${vatSubmissions.submissionId} IS NOT NULL AND ${vatSubmissions.submissionId} != ''`
        )
      )
      .orderBy(desc(vatSubmissions.taxPeriod));

    // 2. Fetch existing bills for this client to know which months are already billed
    const existingBills = await db
      .select({
        id: bills.id,
        billNo: bills.billNo,
        taxPeriod: bills.taxPeriod,
        status: bills.status
      })
      .from(bills)
      .where(
        and(
          eq(bills.clientId, clientId),
          sql`${bills.status} != 'cancelled'`
        )
      );

    const billedMonthsMap = new Map(existingBills.map((b) => [b.taxPeriod, b]));

    // Format allowed months with submission IDs: "2026-08 — #37001"
    const allowedMonths = clientSubmissions.map((sub) => ({
      taxPeriod: sub.taxPeriod,
      submissionId: sub.submissionId,
      submittedAt: sub.submittedAt,
      isBilled: billedMonthsMap.has(sub.taxPeriod),
      label: `${sub.taxPeriod} — #${sub.submissionId}`
    }));

    // 3. Compute running previous due
    const previousDue = await getClientRunningDue(clientId);

    // 4. Fetch Master Service Items & Rates for this customer type
    const allServiceItems = await db
      .select()
      .from(serviceItems)
      .where(eq(serviceItems.isActive, true));

    const allRates = await db
      .select()
      .from(serviceRates);

    // Build rate lookup map
    const rateMap: Record<number, { regularRate: number; minimumCharge: number }> = {};
    for (const r of allRates) {
      if (r.customerTypeId === client.customerTypeId || (!rateMap[r.serviceItemId] && !r.customerTypeId)) {
        rateMap[r.serviceItemId] = {
          regularRate: r.regularRate,
          minimumCharge: r.minimumCharge
        };
      }
    }

    // 5. Auto-calculate suggested line items for selected targetMonth
    const isOnlyReturn = client.vatServiceType === "ONLY_RETURN";
    const suggestedItems: any[] = [];

    // Item A: VAT Return Submission
    const returnItem = allServiceItems.find((s) => s.itemName.toLowerCase().includes("return"));
    const returnRateInfo = returnItem ? rateMap[returnItem.id] : null;
    const returnRate = returnRateInfo ? returnRateInfo.regularRate : 2000;

    suggestedItems.push({
      serviceItemId: returnItem ? returnItem.id : null,
      itemName: "VAT Return Submission",
      unit: "Month",
      qty: 1,
      rateUsed: returnRate,
      minimumChargeUsed: returnRateInfo ? returnRateInfo.minimumCharge : 0,
      calculatedAmount: returnRate,
      finalAmount: returnRate,
      notes: `Monthly VAT return filing for ${targetMonth}`
    });

    // Item B: Books of Accounts (Mushak 6.2.1) Maintenance (if FULL service)
    if (!isOnlyReturn) {
      const booksItem = allServiceItems.find(
        (s) => s.itemName.toLowerCase().includes("books") || s.itemName.toLowerCase().includes("6.2.1")
      );
      const booksRateInfo = booksItem ? rateMap[booksItem.id] : null;
      const booksRate = booksRateInfo ? booksRateInfo.regularRate : 3000;
      const minCharge = booksRateInfo ? booksRateInfo.minimumCharge : 2500;

      // Default calculation: 1 Month or Qty * Rate
      const finalAmt = Math.max(booksRate, minCharge);

      suggestedItems.push({
        serviceItemId: booksItem ? booksItem.id : null,
        itemName: "Books of Accounts (Mushak 6.2.1) Maintenance",
        unit: "Month",
        qty: 1,
        rateUsed: booksRate,
        minimumChargeUsed: minCharge,
        calculatedAmount: booksRate,
        finalAmount: finalAmt,
        notes: `Purchase & Sales accounts maintenance for ${targetMonth}`
      });
    }

    // Check submission status for targetMonth
    const currentSub = clientSubmissions.find((s) => s.taxPeriod === targetMonth);

    return c.json(
      {
        message: "Client billing overview fetched",
        data: {
          client,
          previousDue,
          allowedMonths,
          targetMonthSubmission: currentSub || null,
          isTargetMonthBilled: billedMonthsMap.has(targetMonth),
          suggestedItems,
          masterServices: allServiceItems
        }
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to fetch client billing overview" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 6. CREATE SINGLE BILL ────────────────────────────────────────────

export const createBill: Handler = async (c: any) => {
  try {
    const payload = c.req.valid("json");
    const { clientId, referenceId: payloadRefId, taxPeriod, billDate, dueDate, discountAmount, notes, items, status } = payload;

    // 1. Verify Active Client
    const client = (
      await db
        .select({ id: clients.id, companyName: clients.companyName, isActive: clients.isActive, referenceId: clients.referenceId })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1)
    )[0];

    if (!client) {
      return c.json({ message: "Client not found" }, HttpStatusCodes.NOT_FOUND);
    }
    if (!client.isActive) {
      return c.json({ message: "Cannot create bill for disabled/inactive client" }, HttpStatusCodes.BAD_REQUEST);
    }

    // 2. CRITICAL RULE: Verify finalized VAT Submission ID exists for this month
    const submission = (
      await db
        .select({ id: vatSubmissions.id, submissionId: vatSubmissions.submissionId })
        .from(vatSubmissions)
        .where(
          and(
            eq(vatSubmissions.clientId, clientId),
            eq(vatSubmissions.taxPeriod, taxPeriod)
          )
        )
        .limit(1)
    )[0];

    if (!submission || !submission.submissionId || !submission.submissionId.trim()) {
      return c.json(
        {
          message: `Cannot create bill: No finalized VAT Return Submission ID found for ${taxPeriod}. Please record the submission ID first.`
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // 3. Prevent duplicate bill for same client and taxPeriod
    const duplicate = (
      await db
        .select({ id: bills.id, billNo: bills.billNo })
        .from(bills)
        .where(
          and(
            eq(bills.clientId, clientId),
            eq(bills.taxPeriod, taxPeriod),
            sql`${bills.status} != 'cancelled'`
          )
        )
        .limit(1)
    )[0];

    if (duplicate) {
      return c.json(
        { message: `Invoice ${duplicate.billNo} already exists for ${taxPeriod}` },
        HttpStatusCodes.CONFLICT
      );
    }

    // 4. Calculate amounts
    const parsedBillDate = new Date(billDate);
    const year = parsedBillDate.getFullYear() || new Date().getFullYear();

    const subtotal = r2(items.reduce((acc, it) => acc + (it.finalAmount || 0), 0));
    const previousDue = await getClientRunningDue(clientId);
    const discount = r2(discountAmount || 0);
    const grandTotal = r2(Math.max(0, subtotal - discount + previousDue));
    const dueAmount = grandTotal;

    // 5. Generate sequential bill number: Inv-YYYY-000001
    const billNo = await generateNextBillNo(year);

    // 6. Insert Bill in DB
    const newBill = (
      await db
        .insert(bills)
        .values({
          billNo,
          clientId,
          referenceId: payloadRefId !== undefined && payloadRefId !== null ? payloadRefId : client.referenceId,
          taxPeriod,
          billDate: parsedBillDate,
          dueDate: dueDate ? new Date(dueDate) : null,
          subtotal,
          discountAmount: discount,
          previousDue,
          grandTotal,
          paidAmount: 0,
          dueAmount,
          status: status === "draft" ? "draft" : "unpaid",
          notes: notes?.trim() || null
        })
        .returning()
    )[0];

    // 7. Insert Line Items
    if (items.length > 0) {
      await db.insert(billItems).values(
        items.map((it) => ({
          billId: newBill.id,
          serviceItemId: it.serviceItemId || null,
          itemName: it.itemName.trim(),
          unit: it.unit || "Month",
          qty: it.qty || 1,
          rateUsed: it.rateUsed || 0,
          minimumChargeUsed: it.minimumChargeUsed || 0,
          calculatedAmount: it.calculatedAmount || 0,
          finalAmount: it.finalAmount,
          notes: it.notes?.trim() || null
        }))
      );
    }

    return c.json(
      {
        message: `Invoice ${billNo} created successfully`,
        data: newBill
      },
      HttpStatusCodes.CREATED
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to create bill" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 7. BATCH GENERATE BILLS ──────────────────────────────────────────

export const batchGenerateBills: Handler = async (c: any) => {
  try {
    const payload = c.req.valid("json");
    const { taxPeriod, billDate, dueDate, clientIds } = payload;

    const parsedBillDate = billDate ? new Date(billDate) : new Date();
    const year = parsedBillDate.getFullYear();

    // 1. Fetch all Active Clients
    let clientQuery = db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        customerTypeId: clients.customerTypeId,
        referenceId: clients.referenceId,
        vatServiceType: clients.vatServiceType,
        isActive: clients.isActive
      })
      .from(clients)
      .where(eq(clients.isActive, true));

    const activeClients = await clientQuery;
    if (activeClients.length === 0) {
      return c.json({ message: "No active clients found" }, HttpStatusCodes.NOT_FOUND);
    }

    // Filter by specific clientIds if provided
    let targetClients = activeClients;
    if (clientIds && clientIds.length > 0) {
      targetClients = activeClients.filter((cl) => clientIds.includes(cl.id));
    }

    // 2. Fetch existing bills for this taxPeriod to skip already billed clients
    const existingBills = await db
      .select({ clientId: bills.clientId })
      .from(bills)
      .where(
        and(
          eq(bills.taxPeriod, taxPeriod),
          sql`${bills.status} != 'cancelled'`
        )
      );
    const billedClientIds = new Set(existingBills.map((b) => b.clientId));

    // 3. Fetch all finalized submissions for this taxPeriod
    const submissions = await db
      .select({ clientId: vatSubmissions.clientId, submissionId: vatSubmissions.submissionId })
      .from(vatSubmissions)
      .where(
        and(
          eq(vatSubmissions.taxPeriod, taxPeriod),
          sql`${vatSubmissions.submissionId} IS NOT NULL AND ${vatSubmissions.submissionId} != ''`
        )
      );
    const finalizedClientIds = new Set(submissions.map((s) => s.clientId));

    // 4. Fetch Master Services & Rates
    const allServices = await db.select().from(serviceItems).where(eq(serviceItems.isActive, true));
    const allRates = await db.select().from(serviceRates);

    const returnItem = allServices.find((s) => s.itemName.toLowerCase().includes("return"));
    const booksItem = allServices.find(
      (s) => s.itemName.toLowerCase().includes("books") || s.itemName.toLowerCase().includes("6.2.1")
    );

    const createdBillsList: any[] = [];
    let skippedCount = 0;

    for (const client of targetClients) {
      // Skip if already billed
      if (billedClientIds.has(client.id)) {
        skippedCount++;
        continue;
      }
      // Skip if NO finalized submission ID for this month
      if (!finalizedClientIds.has(client.id)) {
        skippedCount++;
        continue;
      }

      // Rates lookup for this client's customer type
      const clientRates = allRates.filter((r) => r.customerTypeId === client.customerTypeId || !r.customerTypeId);
      const returnRateObj = clientRates.find((r) => returnItem && r.serviceItemId === returnItem.id);
      const booksRateObj = clientRates.find((r) => booksItem && r.serviceItemId === booksItem.id);

      const returnRate = returnRateObj ? returnRateObj.regularRate : 2000;
      const booksRate = booksRateObj ? booksRateObj.regularRate : 3000;
      const booksMin = booksRateObj ? booksRateObj.minimumCharge : 2500;

      // Generate Line Items
      const itemsToInsert: any[] = [];

      // 1. VAT Return Fee
      itemsToInsert.push({
        serviceItemId: returnItem ? returnItem.id : null,
        itemName: "VAT Return Submission",
        unit: "Month",
        qty: 1,
        rateUsed: returnRate,
        minimumChargeUsed: returnRateObj ? returnRateObj.minimumCharge : 0,
        calculatedAmount: returnRate,
        finalAmount: returnRate,
        notes: `Monthly VAT return filing for ${taxPeriod}`
      });

      // 2. Books of Accounts Fee (if FULL Service)
      if (client.vatServiceType === "FULL") {
        const finalBooksAmt = Math.max(booksRate, booksMin);
        itemsToInsert.push({
          serviceItemId: booksItem ? booksItem.id : null,
          itemName: "Books of Accounts (Mushak 6.2.1) Maintenance",
          unit: "Month",
          qty: 1,
          rateUsed: booksRate,
          minimumChargeUsed: booksMin,
          calculatedAmount: booksRate,
          finalAmount: finalBooksAmt,
          notes: `Purchase & Sales accounts maintenance for ${taxPeriod}`
        });
      }

      // Calculate totals
      const subtotal = r2(itemsToInsert.reduce((acc, it) => acc + it.finalAmount, 0));
      const previousDue = await getClientRunningDue(client.id);
      const grandTotal = r2(subtotal + previousDue);

      // Generate sequential billNo
      const billNo = await generateNextBillNo(year);

      // Insert Bill
      const billRecord = (
        await db
          .insert(bills)
          .values({
            billNo,
            clientId: client.id,
            referenceId: client.referenceId || null,
            taxPeriod,
            billDate: parsedBillDate,
            dueDate: dueDate ? new Date(dueDate) : null,
            subtotal,
            discountAmount: 0,
            previousDue,
            grandTotal,
            paidAmount: 0,
            dueAmount: grandTotal,
            status: "unpaid",
            notes: `Batch generated monthly bill for ${taxPeriod}`
          })
          .returning()
      )[0];

      // Insert Items
      await db.insert(billItems).values(
        itemsToInsert.map((it) => ({
          billId: billRecord.id,
          serviceItemId: it.serviceItemId,
          itemName: it.itemName,
          unit: it.unit,
          qty: it.qty,
          rateUsed: it.rateUsed,
          minimumChargeUsed: it.minimumChargeUsed,
          calculatedAmount: it.calculatedAmount,
          finalAmount: it.finalAmount,
          notes: it.notes
        }))
      );

      createdBillsList.push({
        id: billRecord.id,
        billNo: billRecord.billNo,
        companyName: client.companyName,
        grandTotal: billRecord.grandTotal
      });
    }

    return c.json(
      {
        message: `Batch generation complete. ${createdBillsList.length} invoices created successfully.`,
        createdCount: createdBillsList.length,
        skippedCount,
        data: createdBillsList
      },
      HttpStatusCodes.CREATED
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to batch generate bills" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 8. GET MISSING BILLS LIST ────────────────────────────────────────

export const getMissingBills: Handler = async (c: any) => {
  try {
    const query = c.req.valid("query");
    const month = query.month || query.taxPeriod || new Date().toISOString().slice(0, 7);

    // Fetch all Active Clients
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
        vatServiceType: clients.vatServiceType
      })
      .from(clients)
      .leftJoin(customerTypes, eq(clients.customerTypeId, customerTypes.id))
      .leftJoin(clientReferences, eq(clients.referenceId, clientReferences.id))
      .where(eq(clients.isActive, true))
      .orderBy(asc(clients.companyName));

    if (activeClients.length === 0) {
      return c.json({ message: "No active clients found", data: [] }, HttpStatusCodes.OK);
    }

    // Fetch already billed client IDs for this month
    const existingBills = await db
      .select({ clientId: bills.clientId })
      .from(bills)
      .where(
        and(
          eq(bills.taxPeriod, month),
          sql`${bills.status} != 'cancelled'`
        )
      );
    const billedSet = new Set(existingBills.map((b) => b.clientId));

    // Fetch finalized submissions for this month
    const submissions = await db
      .select({
        clientId: vatSubmissions.clientId,
        submissionId: vatSubmissions.submissionId,
        submittedAt: vatSubmissions.submittedAt
      })
      .from(vatSubmissions)
      .where(
        and(
          eq(vatSubmissions.taxPeriod, month),
          sql`${vatSubmissions.submissionId} IS NOT NULL AND ${vatSubmissions.submissionId} != ''`
        )
      );

    const subMap = new Map<number, any>(submissions.map((s) => [s.clientId, s]));

    // Fetch Master Services and Rates to calculate exact service fee
    const allServices = await db.select().from(serviceItems).where(eq(serviceItems.isActive, true));
    const allRates = await db.select().from(serviceRates);

    const returnItem = allServices.find((s) => s.itemName.toLowerCase().includes("return"));
    const booksItem = allServices.find(
      (s) => s.itemName.toLowerCase().includes("books") || s.itemName.toLowerCase().includes("6.2.1")
    );

    const missingList: any[] = [];

    for (const cl of activeClients) {
      // Only include unbilled clients
      if (!billedSet.has(cl.id)) {
        const sub = subMap.get(cl.id);
        const prevDue = await getClientRunningDue(cl.id);

        // Compute exact service fee
        const clientRates = allRates.filter((r) => r.customerTypeId === cl.customerTypeId || !r.customerTypeId);
        const returnRateObj = clientRates.find((r) => returnItem && r.serviceItemId === returnItem.id);
        const booksRateObj = clientRates.find((r) => booksItem && r.serviceItemId === booksItem.id);

        const returnRate = returnRateObj ? returnRateObj.regularRate : 2000;
        const booksRate = booksRateObj ? booksRateObj.regularRate : 3000;
        const booksMin = booksRateObj ? booksRateObj.minimumCharge : 2500;

        let monthlyServiceFee = returnRate;
        if (cl.vatServiceType === "FULL") {
          monthlyServiceFee += Math.max(booksRate, booksMin);
        }

        missingList.push({
          id: cl.id,
          companyName: cl.companyName,
          binNumber: cl.binNumber,
          mobile: cl.mobile,
          customerTypeName: cl.customerTypeName,
          referenceName: cl.referenceName,
          vatServiceType: cl.vatServiceType,
          targetMonth: month,
          submissionId: sub ? sub.submissionId : null,
          isSubmitted: !!sub,
          previousDue: prevDue,
          monthlyServiceFee: r2(monthlyServiceFee)
        });
      }
    }

    return c.json(
      {
        message: "Missing bills fetched successfully",
        data: missingList,
        totalMissing: missingList.length,
        readyToBillCount: missingList.filter((m) => m.isSubmitted).length
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to fetch missing bills" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 9. UPDATE & DELETE BILL ──────────────────────────────────────────

export const updateBill: Handler = async (c: any) => {
  try {
    const id = Number(c.req.param("id"));
    const payload = c.req.valid("json");

    const existing = (
      await db.select().from(bills).where(eq(bills.id, id)).limit(1)
    )[0];

    if (!existing) {
      return c.json({ message: "Bill not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const updatedData: any = {
      updatedAt: new Date()
    };

    if (payload.billDate) updatedData.billDate = new Date(payload.billDate);
    if (payload.dueDate !== undefined) updatedData.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
    if (payload.notes !== undefined) updatedData.notes = payload.notes;
    if (payload.status) updatedData.status = payload.status;

    if (payload.items && payload.items.length > 0) {
      // Recompute subtotal
      const newSubtotal = r2(payload.items.reduce((acc, it) => acc + (it.finalAmount || 0), 0));
      const discount = payload.discountAmount !== undefined ? r2(payload.discountAmount) : existing.discountAmount;
      const grandTotal = r2(Math.max(0, newSubtotal - discount + existing.previousDue));
      const dueAmount = r2(Math.max(0, grandTotal - existing.paidAmount));

      updatedData.subtotal = newSubtotal;
      updatedData.discountAmount = discount;
      updatedData.grandTotal = grandTotal;
      updatedData.dueAmount = dueAmount;

      // Replace items
      await db.delete(billItems).where(eq(billItems.billId, id));
      await db.insert(billItems).values(
        payload.items.map((it) => ({
          billId: id,
          serviceItemId: it.serviceItemId || null,
          itemName: it.itemName.trim(),
          unit: it.unit || "Month",
          qty: it.qty || 1,
          rateUsed: it.rateUsed || 0,
          minimumChargeUsed: it.minimumChargeUsed || 0,
          calculatedAmount: it.calculatedAmount || 0,
          finalAmount: it.finalAmount,
          notes: it.notes?.trim() || null
        }))
      );
    }

    const result = (
      await db.update(bills).set(updatedData).where(eq(bills.id, id)).returning()
    )[0];

    return c.json(
      { message: `Invoice ${existing.billNo} updated successfully`, data: result },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to update bill" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const deleteBill: Handler = async (c: any) => {
  try {
    const id = Number(c.req.param("id"));
    const existing = (
      await db.select().from(bills).where(eq(bills.id, id)).limit(1)
    )[0];

    if (!existing) {
      return c.json({ message: "Bill not found" }, HttpStatusCodes.NOT_FOUND);
    }

    // Delete bill items cascade and delete bill
    await db.delete(billItems).where(eq(billItems.billId, id));
    await db.delete(bills).where(eq(bills.id, id));

    return c.json(
      { message: `Invoice ${existing.billNo} deleted successfully` },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to delete bill" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 10. COLLECTIONS & MONEY RECEIPTS ─────────────────────────────────

export const listCollections: Handler = async (c: any) => {
  try {
    const query = c.req.valid("query");
    let conditions: any[] = [];

    if (query.clientId && query.clientId !== "all") {
      conditions.push(eq(collections.clientId, Number(query.clientId)));
    }
    if (query.paymentMethod && query.paymentMethod !== "all") {
      conditions.push(eq(collections.paymentMethod, query.paymentMethod));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: collections.id,
        receiptNo: collections.receiptNo,
        billId: collections.billId,
        billNo: bills.billNo,
        clientId: collections.clientId,
        clientName: clients.companyName,
        clientBin: clients.binNumber,
        collectionDate: collections.collectionDate,
        amount: collections.amount,
        paymentMethod: collections.paymentMethod,
        referenceNo: collections.referenceNo,
        notes: collections.notes,
        receivedById: collections.receivedBy,
        receivedByName: users.name,
        status: collections.status,
        createdAt: collections.createdAt
      })
      .from(collections)
      .leftJoin(clients, eq(collections.clientId, clients.id))
      .leftJoin(bills, eq(collections.billId, bills.id))
      .leftJoin(users, eq(collections.receivedBy, users.id))
      .where(whereClause)
      .orderBy(desc(collections.id));

    let list = rows;
    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.receiptNo.toLowerCase().includes(q) ||
          r.clientName?.toLowerCase().includes(q) ||
          r.billNo?.toLowerCase().includes(q) ||
          r.referenceNo?.toLowerCase().includes(q)
      );
    }

    const totalCollected = r2(list.filter((r) => r.status === "completed").reduce((acc, c) => acc + c.amount, 0));

    return c.json(
      {
        message: "Collections fetched successfully",
        data: list,
        totalCollected,
        count: list.length
      },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to fetch collections" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const createCollection: Handler = async (c: any) => {
  try {
    const payload = c.req.valid("json");
    const { clientId, billId, collectionDate, amount, paymentMethod, referenceNo, notes } = payload;

    const client = (
      await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
    )[0];

    if (!client) {
      return c.json({ message: "Client not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const parsedDate = new Date(collectionDate);
    const year = parsedDate.getFullYear() || new Date().getFullYear();

    // Generate Money Receipt No: MR-YYYY-000001
    const receiptNo = await generateNextReceiptNo(year);

    const newCollection = (
      await db
        .insert(collections)
        .values({
          receiptNo,
          billId: billId || null,
          clientId,
          collectionDate: parsedDate,
          amount: r2(amount),
          paymentMethod,
          referenceNo: referenceNo?.trim() || null,
          notes: notes?.trim() || null,
          status: "completed"
        })
        .returning()
    )[0];

    // If linked to a specific bill, update bill's paidAmount & dueAmount
    if (billId) {
      const targetBill = (
        await db.select().from(bills).where(eq(bills.id, billId)).limit(1)
      )[0];

      if (targetBill) {
        const newPaid = r2(targetBill.paidAmount + amount);
        const newDue = r2(Math.max(0, targetBill.grandTotal - newPaid));
        let newStatus = targetBill.status;

        if (newDue === 0) {
          newStatus = "paid";
        } else if (newPaid > 0) {
          newStatus = "partial";
        }

        await db
          .update(bills)
          .set({
            paidAmount: newPaid,
            dueAmount: newDue,
            status: newStatus,
            updatedAt: new Date()
          })
          .where(eq(bills.id, billId));
      }
    }

    return c.json(
      {
        message: `Payment receipt ${receiptNo} created successfully`,
        data: newCollection
      },
      HttpStatusCodes.CREATED
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to record collection" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const cancelCollection: Handler = async (c: any) => {
  try {
    const id = Number(c.req.param("id"));
    const col = (
      await db.select().from(collections).where(eq(collections.id, id)).limit(1)
    )[0];

    if (!col) {
      return c.json({ message: "Collection not found" }, HttpStatusCodes.NOT_FOUND);
    }

    // Mark collection cancelled
    await db
      .update(collections)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(collections.id, id));

    // Revert linked bill amounts if applicable
    if (col.billId) {
      const targetBill = (
        await db.select().from(bills).where(eq(bills.id, col.billId)).limit(1)
      )[0];

      if (targetBill) {
        const newPaid = r2(Math.max(0, targetBill.paidAmount - col.amount));
        const newDue = r2(targetBill.grandTotal - newPaid);
        let newStatus: string = "unpaid";
        if (newPaid > 0) newStatus = "partial";

        await db
          .update(bills)
          .set({
            paidAmount: newPaid,
            dueAmount: newDue,
            status: newStatus,
            updatedAt: new Date()
          })
          .where(eq(bills.id, col.billId));
      }
    }

    return c.json(
      { message: `Receipt ${col.receiptNo} cancelled successfully` },
      HttpStatusCodes.OK
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to cancel collection" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
