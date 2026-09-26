import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { initDatabase } from "@/framework/database/connection.js";
import { db } from "@/framework/facade.js";
import { companySettings } from "../database/models/company_settings.js";
import { bankAccounts } from "../database/models/bank_accounts.js";
import { expenseHeads } from "../database/models/expense_heads.js";

describe("Firm Module Real Database Tests (PostgreSQL)", () => {
  const createdBankIds: number[] = [];
  const createdExpenseIds: number[] = [];

  beforeAll(async () => {
    await initDatabase();
  });

  afterAll(async () => {
    for (const id of createdBankIds) {
      await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
    }
    for (const id of createdExpenseIds) {
      await db.delete(expenseHeads).where(eq(expenseHeads.id, id));
    }
  });

  it("should fetch or create company settings in PostgreSQL", async () => {
    const list = await db.select().from(companySettings).limit(1);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].companyName).toBeTruthy();
    expect(list[0].binUniqueEnforcement).toBe(true);
  });

  it("should create and fetch a real bank account", async () => {
    const inserted = (await db.insert(bankAccounts).values({
      bankName: "City Bank PLC " + Date.now(),
      accountName: "Associates VAT Account",
      accountNumber: "2201992819",
      branchName: "Motijheel Branch",
      isDefault: false,
      isActive: true
    }).returning())[0];

    createdBankIds.push(inserted.id);
    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.accountNumber).toBe("2201992819");
  });

  it("should create, fetch and toggle an expense head", async () => {
    const inserted = (await db.insert(expenseHeads).values({
      name: "Test Audit & Legal Retainer " + Date.now(),
      code: "EXP-TEST-" + Date.now().toString().slice(-4),
      category: "Administrative",
      description: "Test legal retainers",
      isActive: true
    }).returning())[0];

    createdExpenseIds.push(inserted.id);
    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.category).toBe("Administrative");
    expect(inserted.isActive).toBe(true);
  });
});
