import { describe, expect, it, beforeAll } from "bun:test";
import { initDatabase } from "@/framework/database/connection.js";
import { db } from "@/framework/facade.js";
import { clients } from "../database/models/clients.js";
import { clientManagers } from "../database/models/client_managers.js";
import { customerTypes } from "@/modules/services/database/models/customer_types.js";
import { users } from "@/modules/auth/database/models/user.js";
import { eq } from "drizzle-orm";

describe("Clients Module Real Database Tests (PostgreSQL)", () => {
  let testTypeId: number;
  let testUserId: number;
  let testClientId: number;

  beforeAll(async () => {
    await initDatabase();

    // Ensure at least one customer type
    const existingType = (await db.select().from(customerTypes).limit(1))[0];
    if (existingType) {
      testTypeId = existingType.id;
    } else {
      const created = (
        await db
          .insert(customerTypes)
          .values({
            typeName: "Test Importer " + Date.now(),
            isActive: true
          })
          .returning()
      )[0];
      testTypeId = created.id;
    }

    // Ensure at least one user
    const existingUser = (await db.select().from(users).limit(1))[0];
    if (existingUser) {
      testUserId = existingUser.id;
    } else {
      const createdUser = (
        await db
          .insert(users)
          .values({
            name: "Test Manager Staff",
            email: "manager_" + Date.now() + "@test.com",
            password: "hashed_password"
          })
          .returning()
      )[0];
      testUserId = createdUser.id;
    }
  });

  it("should create a real client with full fields and verify in PostgreSQL", async () => {
    const testBin = "BIN-" + Date.now();
    const created = (
      await db
        .insert(clients)
        .values({
          companyName: "Meghna Traders & Logistics Ltd.",
          proprietorName: "Haji Md. Yunus Ali",
          mobile: "+880 1711-889900",
          alternativeMobile: "+880 1819-112233",
          email: "yunus@meghnatraders.com",
          address: "12/A Motijheel C/A, Dhaka",
          binNumber: testBin,
          tinNumber: "123456789012",
          tradeLicenseNo: "TRAD/DSCC/998877",
          customerTypeId: testTypeId,
          vatUserId: "meghna_vat",
          vatPassword: "SecretVatPassword!123",
          vatServiceType: "FULL",
          isActive: true
        })
        .returning()
    )[0];

    expect(created).toBeDefined();
    expect(created.id).toBeGreaterThan(0);
    expect(created.companyName).toBe("Meghna Traders & Logistics Ltd.");
    expect(created.binNumber).toBe(testBin);
    expect(created.isActive).toBe(true);

    testClientId = created.id;
  });

  it("should assign manager to the client and query client_managers relationship", async () => {
    // Assign manager
    const assigned = (
      await db
        .insert(clientManagers)
        .values({
          clientId: testClientId,
          managerId: testUserId
        })
        .returning()
    )[0];

    expect(assigned).toBeDefined();
    expect(assigned.clientId).toBe(testClientId);
    expect(assigned.managerId).toBe(testUserId);

    // Verify through select join
    const mgrList = await db
      .select({
        managerId: clientManagers.managerId,
        managerName: users.name
      })
      .from(clientManagers)
      .innerJoin(users, eq(clientManagers.managerId, users.id))
      .where(eq(clientManagers.clientId, testClientId));

    expect(mgrList.length).toBe(1);
    expect(mgrList[0].managerId).toBe(testUserId);
  });

  it("should toggle client active status", async () => {
    const toggled = (
      await db
        .update(clients)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(clients.id, testClientId))
        .returning()
    )[0];

    expect(toggled.isActive).toBe(false);

    // Toggle back to active
    const reactivated = (
      await db
        .update(clients)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(clients.id, testClientId))
        .returning()
    )[0];

    expect(reactivated.isActive).toBe(true);
  });

  it("should clean up test client and cascade delete manager assignments", async () => {
    await db.delete(clients).where(eq(clients.id, testClientId));

    const checkClient = (await db.select().from(clients).where(eq(clients.id, testClientId)).limit(1))[0];
    expect(checkClient).toBeUndefined();

    const checkManagers = await db.select().from(clientManagers).where(eq(clientManagers.clientId, testClientId));
    expect(checkManagers.length).toBe(0);
  });
});
