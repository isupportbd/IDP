import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { initDatabase } from "@/framework/database/connection.js";
import { db } from "@/framework/facade.js";
import { customerTypes } from "../database/models/customer_types.js";
import { serviceItems } from "../database/models/service_items.js";
import { serviceRates } from "../database/models/service_rates.js";

describe("Services Module Real Database Tests", () => {
  const createdCustomerTypeIds: number[] = [];
  const createdServiceItemIds: number[] = [];
  const createdServiceRateIds: number[] = [];

  beforeAll(async () => {
    await initDatabase();
  });

  afterAll(async () => {
    for (const id of createdServiceRateIds) {
      await db.delete(serviceRates).where(eq(serviceRates.id, id));
    }
    for (const id of createdServiceItemIds) {
      await db.delete(serviceItems).where(eq(serviceItems.id, id));
    }
    for (const id of createdCustomerTypeIds) {
      await db.delete(customerTypes).where(eq(customerTypes.id, id));
    }
  });

  it("should create and fetch a real customer type", async () => {
    const inserted = (await db.insert(customerTypes).values({
      typeName: "Test Importer " + Date.now(),
      description: "Test commercial importer",
      isActive: true
    }).returning())[0];

    createdCustomerTypeIds.push(inserted.id);
    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.isActive).toBe(true);
  });

  it("should create and fetch a real service item", async () => {
    const inserted = (await db.insert(serviceItems).values({
      itemName: "Test Mushak 9.1 Filing " + Date.now(),
      isActive: true
    }).returning())[0];

    createdServiceItemIds.push(inserted.id);
    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.isActive).toBe(true);
  });

  it("should create and fetch a real service rate with foreign keys", async () => {
    const item = (await db.insert(serviceItems).values({
      itemName: "Test Bookkeeping " + Date.now(),
      isActive: true
    }).returning())[0];
    createdServiceItemIds.push(item.id);

    const cType = (await db.insert(customerTypes).values({
      typeName: "Test Manufacturer " + Date.now(),
      isActive: true
    }).returning())[0];
    createdCustomerTypeIds.push(cType.id);

    const rate = (await db.insert(serviceRates).values({
      serviceItemId: item.id,
      customerTypeId: cType.id,
      regularRate: 2500,
      minimumCharge: 1500,
      effectiveFrom: "2026-09-01"
    }).returning())[0];
    createdServiceRateIds.push(rate.id);

    expect(rate.id).toBeGreaterThan(0);
    expect(rate.regularRate).toBe(2500);
    expect(rate.minimumCharge).toBe(1500);
    expect(rate.effectiveFrom).toBe("2026-09-01");
  });
});
