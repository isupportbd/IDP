import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { initDatabase } from "@/framework/database/connection.js";
import { db } from "@/framework/facade.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { vatSubmissions } from "@/modules/clients/database/models/vat_submissions.js";
import { users } from "@/modules/auth/database/models/user.js";
import { and, eq } from "drizzle-orm";
import { OpenAPIHono } from "@hono/zod-openapi";
import activityFilterRouter from "../routes/api.js";

describe("Activity Filter Module Integration Tests", () => {
  let app: OpenAPIHono;
  let testUserId: number;
  let testClientId1: number;
  let testClientId2: number;
  const testMonth = "2026-08";

  beforeAll(async () => {
    await initDatabase();

    app = new OpenAPIHono();
    app.route("/api/activity-filter", activityFilterRouter);

    // Ensure user
    const existingUser = (await db.select().from(users).limit(1))[0];
    if (existingUser) {
      testUserId = existingUser.id;
    } else {
      const u = (
        await db
          .insert(users)
          .values({
            name: "Activity Officer",
            email: `activity_${Date.now()}@test.com`,
            password: "hashed_password"
          })
          .returning()
      )[0];
      testUserId = u.id;
    }

    // Create client 1 (Submitted)
    const c1 = (
      await db
        .insert(clients)
        .values({
          companyName: `Activity Test Org 1 ${Date.now()}`,
          binNumber: `BIN-${Date.now()}-1`,
          isActive: true
        })
        .returning()
    )[0];
    testClientId1 = c1.id;

    // Create client 2 (Unsubmitted)
    const c2 = (
      await db
        .insert(clients)
        .values({
          companyName: `Activity Test Org 2 ${Date.now()}`,
          binNumber: `BIN-${Date.now()}-2`,
          isActive: true
        })
        .returning()
    )[0];
    testClientId2 = c2.id;

    // Record submission for client 1
    await db.insert(vatSubmissions).values({
      clientId: testClientId1,
      taxPeriod: testMonth,
      submissionId: `NBR-TEST-${Date.now()}`,
      status: "submitted",
      submittedBy: testUserId
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testClientId1) {
      await db.delete(vatSubmissions).where(eq(vatSubmissions.clientId, testClientId1));
      await db.delete(clients).where(eq(clients.id, testClientId1));
    }
    if (testClientId2) {
      await db.delete(clients).where(eq(clients.id, testClientId2));
    }
  });

  it("GET /api/activity-filter returns matrix data with statistics", async () => {
    const res = await app.request(`/api/activity-filter?month=${testMonth}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.stats).toBeDefined();
    expect(body.taxPeriod).toBe(testMonth);
    expect(body.stats.totalClients).toBeGreaterThanOrEqual(2);
    expect(body.stats.totalFiledClients).toBeGreaterThanOrEqual(1);
    expect(body.stats.totalUnfiledClients).toBeGreaterThanOrEqual(1);

    // Verify client 1 has submission
    const found1 = body.data.find((c: any) => c.id === testClientId1);
    expect(found1).toBeDefined();
    expect(found1.isSubmitted).toBe(true);
    expect(found1.submission).toBeDefined();

    // Verify client 2 has no submission
    const found2 = body.data.find((c: any) => c.id === testClientId2);
    expect(found2).toBeDefined();
    expect(found2.isSubmitted).toBe(false);
    expect(found2.submission).toBeNull();
  });
});
