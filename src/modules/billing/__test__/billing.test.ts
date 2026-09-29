import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { initDatabase } from "@/framework/database/connection.js";
import { db } from "@/framework/facade.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { vatSubmissions } from "@/modules/clients/database/models/vat_submissions.js";
import { customerTypes } from "@/modules/services/database/models/customer_types.js";
import { serviceItems } from "@/modules/services/database/models/service_items.js";
import { serviceRates } from "@/modules/services/database/models/service_rates.js";
import { bills } from "../database/models/bills.js";
import { billItems } from "../database/models/bill_items.js";
import { collections } from "../database/models/collections.js";

describe("Billing & Collections Module Real Database Tests (PostgreSQL)", () => {
  let testClientId: number;
  let testCustomerTypeId: number;
  let returnItemId: number;
  let booksItemId: number;

  beforeAll(async () => {
    await initDatabase();

    // 1. Create or ensure test Customer Type
    const existingType = (
      await db.select().from(customerTypes).where(eq(customerTypes.typeName, "Test Billing Importer")).limit(1)
    )[0];
    if (existingType) {
      testCustomerTypeId = existingType.id;
    } else {
      const newType = (
        await db
          .insert(customerTypes)
          .values({
            typeName: "Test Billing Importer",
            description: "For Billing Test Suite",
            isActive: true
          })
          .returning()
      )[0];
      testCustomerTypeId = newType.id;
    }

    // 2. Ensure Service Items & Rates
    const existingReturn = (
      await db.select().from(serviceItems).where(eq(serviceItems.itemName, "VAT Return Submission")).limit(1)
    )[0];
    if (existingReturn) {
      returnItemId = existingReturn.id;
    } else {
      const item = (
        await db.insert(serviceItems).values({ itemName: "VAT Return Submission", isActive: true }).returning()
      )[0];
      returnItemId = item.id;
    }

    const existingBooks = (
      await db
        .select()
        .from(serviceItems)
        .where(eq(serviceItems.itemName, "Books of Accounts (Mushak 6.2.1) Maintenance"))
        .limit(1)
    )[0];
    if (existingBooks) {
      booksItemId = existingBooks.id;
    } else {
      const item = (
        await db
          .insert(serviceItems)
          .values({ itemName: "Books of Accounts (Mushak 6.2.1) Maintenance", isActive: true })
          .returning()
      )[0];
      booksItemId = item.id;
    }

    // 3. Create or ensure Rates for testCustomerTypeId
    const existingRate1 = (
      await db
        .select()
        .from(serviceRates)
        .where(and(eq(serviceRates.serviceItemId, returnItemId), eq(serviceRates.customerTypeId, testCustomerTypeId)))
        .limit(1)
    )[0];
    if (!existingRate1) {
      await db.insert(serviceRates).values({
        serviceItemId: returnItemId,
        customerTypeId: testCustomerTypeId,
        regularRate: 2000,
        minimumCharge: 1500,
        effectiveFrom: "2026-01-01"
      });
    }

    const existingRate2 = (
      await db
        .select()
        .from(serviceRates)
        .where(and(eq(serviceRates.serviceItemId, booksItemId), eq(serviceRates.customerTypeId, testCustomerTypeId)))
        .limit(1)
    )[0];
    if (!existingRate2) {
      await db.insert(serviceRates).values({
        serviceItemId: booksItemId,
        customerTypeId: testCustomerTypeId,
        regularRate: 2.5, // 2.5 Tk per MT
        minimumCharge: 500, // 500 Tk min charge
        effectiveFrom: "2026-01-01"
      });
    }

    // 4. Create Test Active Client
    const testClient = (
      await db
        .insert(clients)
        .values({
          companyName: "Apex Steel Testing Mills Ltd",
          binNumber: "009988776-0909",
          mobile: "01799887766",
          customerTypeId: testCustomerTypeId,
          vatServiceType: "FULL",
          isActive: true
        })
        .returning()
    )[0];
    testClientId = testClient.id;

    // 5. Create Finalized Submission for 2026-08
    await db.insert(vatSubmissions).values({
      clientId: testClientId,
      taxPeriod: "2026-08",
      submissionId: "37001",
      status: "submitted",
      submittedAt: new Date("2026-09-14T10:00:00Z")
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testClientId) {
      await db.delete(collections).where(eq(collections.clientId, testClientId));
      await db.delete(bills).where(eq(bills.clientId, testClientId));
      await db.delete(vatSubmissions).where(eq(vatSubmissions.clientId, testClientId));
      await db.delete(clients).where(eq(clients.id, testClientId));
    }
  });

  it("should generate sequential invoice number INV-YYYY-000001", async () => {
    const year = 2026;
    const prefix = `INV-${year}-`;
    const latestBill = (
      await db
        .select({ billNo: bills.billNo })
        .from(bills)
        .where(like(bills.billNo, `${prefix}%`))
        .orderBy(desc(bills.id))
        .limit(1)
    )[0];

    let nextNum = 1;
    if (latestBill) {
      const parts = latestBill.billNo.split("-");
      if (parts.length >= 3) {
        nextNum = parseInt(parts[2], 10) + 1;
      }
    }

    const billNo = `${prefix}${String(nextNum).padStart(6, "0")}`;
    expect(billNo).toMatch(/^INV-2026-\d{6}$/);

    const newBill = (
      await db
        .insert(bills)
        .values({
          billNo,
          clientId: testClientId,
          taxPeriod: "2026-08",
          billDate: new Date("2026-09-15"),
          subtotal: 5750,
          discountAmount: 0,
          previousDue: 0,
          grandTotal: 5750,
          paidAmount: 0,
          dueAmount: 5750,
          status: "unpaid"
        })
        .returning()
    )[0];

    expect(newBill.id).toBeGreaterThan(0);
    expect(newBill.billNo).toBe(billNo);
    expect(newBill.grandTotal).toBe(5750);
  });

  it("should record line items with Mushak 6.2.1 calculation (Qty 1500 MT x 2.5 = 3750 Tk)", async () => {
    const existingBill = (
      await db.select().from(bills).where(eq(bills.clientId, testClientId)).limit(1)
    )[0];
    expect(existingBill).toBeDefined();

    // Line Item 1: VAT Return
    await db.insert(billItems).values({
      billId: existingBill.id,
      serviceItemId: returnItemId,
      itemName: "VAT Return Submission",
      unit: "Month",
      qty: 1,
      rateUsed: 2000,
      minimumChargeUsed: 1500,
      calculatedAmount: 2000,
      finalAmount: 2000
    });

    // Line Item 2: Mushak 6.2.1 (1500 MT @ 2.5 Tk/MT = 3750 Tk)
    const qtyMT = 1500;
    const rate = 2.5;
    const minCharge = 500;
    const calc = qtyMT * rate; // 3750
    const finalAmount = Math.max(calc, minCharge); // 3750

    const item2 = (
      await db
        .insert(billItems)
        .values({
          billId: existingBill.id,
          serviceItemId: booksItemId,
          itemName: "Books of Accounts (Mushak 6.2.1) Maintenance",
          unit: "MT",
          qty: qtyMT,
          rateUsed: rate,
          minimumChargeUsed: minCharge,
          calculatedAmount: calc,
          finalAmount
        })
        .returning()
    )[0];

    expect(item2.finalAmount).toBe(3750);

    const allItems = await db.select().from(billItems).where(eq(billItems.billId, existingBill.id));
    expect(allItems.length).toBe(2);
    const sum = allItems.reduce((acc, it) => acc + it.finalAmount, 0);
    expect(sum).toBe(5750);
  });

  it("should record collection receipt MR-YYYY-000001 and update invoice paid & due balance", async () => {
    const bill = (
      await db.select().from(bills).where(eq(bills.clientId, testClientId)).limit(1)
    )[0];
    expect(bill).toBeDefined();

    const year = 2026;
    const receiptNo = `MR-${year}-TEST${Date.now().toString().slice(-4)}`;

    const collection = (
      await db
        .insert(collections)
        .values({
          receiptNo,
          billId: bill.id,
          clientId: testClientId,
          collectionDate: new Date(),
          amount: 3000,
          paymentMethod: "bank",
          referenceNo: "CHQ-889977",
          status: "completed"
        })
        .returning()
    )[0];

    expect(collection.id).toBeGreaterThan(0);
    expect(collection.receiptNo).toBe(receiptNo);

    // Update bill
    const newPaid = bill.paidAmount + 3000;
    const newDue = bill.grandTotal - newPaid;
    const updatedBill = (
      await db
        .update(bills)
        .set({
          paidAmount: newPaid,
          dueAmount: newDue,
          status: newDue === 0 ? "paid" : "partial",
          updatedAt: new Date()
        })
        .where(eq(bills.id, bill.id))
        .returning()
    )[0];

    expect(updatedBill.paidAmount).toBe(3000);
    expect(updatedBill.dueAmount).toBe(2750);
    expect(updatedBill.status).toBe("partial");
  });
});
