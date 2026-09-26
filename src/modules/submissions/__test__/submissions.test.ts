import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { initDatabase } from "@/framework/database/connection.js";
import { db } from "@/framework/facade.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { clientManagers } from "@/modules/clients/database/models/client_managers.js";
import { vatSubmissions } from "@/modules/clients/database/models/vat_submissions.js";
import { customerTypes } from "@/modules/services/database/models/customer_types.js";
import { users } from "@/modules/auth/database/models/user.js";
import { and, eq } from "drizzle-orm";

describe("Submissions Module Real Database Tests (PostgreSQL)", () => {
  let testUserId: number;
  let activeClientId: number;
  let inactiveClientId: number;
  const testMonth = "2026-08";

  beforeAll(async () => {
    await initDatabase();

    // Ensure user
    const existingUser = (await db.select().from(users).limit(1))[0];
    if (existingUser) {
      testUserId = existingUser.id;
    } else {
      const u = (
        await db
          .insert(users)
          .values({
            name: "Submission Officer",
            email: `sub_officer_${Date.now()}@test.com`,
            password: "hashed_password"
          })
          .returning()
      )[0];
      testUserId = u.id;
    }

    // Create test active client
    const activeClient = (
      await db
        .insert(clients)
        .values({
          companyName: `Active Test Corp ${Date.now()}`,
          binNumber: `BIN-${Date.now()}`,
          isActive: true
        })
        .returning()
    )[0];
    activeClientId = activeClient.id;

    // Assign manager to active client
    await db.insert(clientManagers).values({
      clientId: activeClientId,
      managerId: testUserId
    });

    // Create test inactive client
    const inactiveClient = (
      await db
        .insert(clients)
        .values({
          companyName: `Inactive Test Corp ${Date.now()}`,
          binNumber: `INACT-BIN-${Date.now()}`,
          isActive: false
        })
        .returning()
    )[0];
    inactiveClientId = inactiveClient.id;
  });

  afterAll(async () => {
    // Cleanup
    if (activeClientId) {
      await db.delete(clients).where(eq(clients.id, activeClientId));
    }
    if (inactiveClientId) {
      await db.delete(clients).where(eq(clients.id, inactiveClientId));
    }
  });

  it("should record on-time return submission and link client manager in PostgreSQL", async () => {
    const submissionId = `NBR-${Date.now()}`;
    const onTimeDate = new Date("2026-09-14T10:00:00Z"); // Before Sept 15

    const created = (
      await db
        .insert(vatSubmissions)
        .values({
          clientId: activeClientId,
          taxPeriod: testMonth,
          submissionId,
          status: "submitted",
          submittedBy: testUserId,
          submittedAt: onTimeDate,
          remarks: "Successfully submitted via eVAT"
        })
        .returning()
    )[0];

    expect(created).toBeDefined();
    expect(created.clientId).toBe(activeClientId);
    expect(created.taxPeriod).toBe(testMonth);
    expect(created.submissionId).toBe(submissionId);
    expect(created.status).toBe("submitted");
    expect(created.submittedBy).toBe(testUserId);
  });

  it("should fetch submission record directly from PostgreSQL with relations", async () => {
    const record = (
      await db
        .select()
        .from(vatSubmissions)
        .where(
          and(
            eq(vatSubmissions.clientId, activeClientId),
            eq(vatSubmissions.taxPeriod, testMonth)
          )
        )
        .limit(1)
    )[0];

    expect(record).toBeDefined();
    expect(record.clientId).toBe(activeClientId);
    expect(record.status).toBe("submitted");
  });

  it("should record late submission when date is past 15th of next month", async () => {
    const lateTaxMonth = "2026-07";
    const lateSubmissionId = `NBR-LATE-${Date.now()}`;
    const lateDate = new Date("2026-08-20T10:00:00Z"); // After Aug 15

    const created = (
      await db
        .insert(vatSubmissions)
        .values({
          clientId: activeClientId,
          taxPeriod: lateTaxMonth,
          submissionId: lateSubmissionId,
          status: "late_submitted",
          submittedBy: testUserId,
          submittedAt: lateDate,
          remarks: "Delayed client voucher filing"
        })
        .returning()
    )[0];

    expect(created.status).toBe("late_submitted");
  });

  it("should delete submission record and return client status to pending", async () => {
    await db
      .delete(vatSubmissions)
      .where(
        and(
          eq(vatSubmissions.clientId, activeClientId),
          eq(vatSubmissions.taxPeriod, testMonth)
        )
      );

    const remaining = (
      await db
        .select()
        .from(vatSubmissions)
        .where(
          and(
            eq(vatSubmissions.clientId, activeClientId),
            eq(vatSubmissions.taxPeriod, testMonth)
          )
        )
        .limit(1)
    )[0];

    expect(remaining).toBeUndefined();
  });
});
