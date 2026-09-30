import { describe, it, expect, beforeAll } from "bun:test";
import { initDatabase } from "@/framework/database/connection.js";
import { db } from "@/framework/facade.js";
import { eq, and } from "drizzle-orm";
import { smsTemplates } from "../database/models/sms_templates.js";
import { smsLogs } from "../database/models/sms_logs.js";
import { renderTemplate, normalizeBdMobile, DEFAULT_TEMPLATES } from "../services/sms.service.js";

beforeAll(async () => {
  await initDatabase();
});

describe("SMS Templates Module Integration Tests", () => {
  it("should render placeholders correctly in template", () => {
    const raw = "ভ্যাট রিটার্ন দাখিল: {{tax_period}}, আইডি: {{submission_id}}, কোম্পানি: {{company_name}}";
    const rendered = renderTemplate(raw, {
      tax_period: "জুলাই ২০২৬",
      submission_id: "VAT-2026-999",
      company_name: "One Associate"
    });

    expect(rendered).toBe("ভ্যাট রিটার্ন দাখিল: জুলাই ২০২৬, আইডি: VAT-2026-999, কোম্পানি: One Associate");
  });

  it("should normalize Bangladesh mobile numbers", () => {
    expect(normalizeBdMobile("01711967548")).toBe("8801711967548");
    expect(normalizeBdMobile("+8801711967548")).toBe("8801711967548");
    expect(normalizeBdMobile("8801711967548")).toBe("8801711967548");
    expect(normalizeBdMobile("invalid")).toBeNull();
    expect(normalizeBdMobile(null)).toBeNull();
  });

  it("should insert and query sms_templates in PostgreSQL", async () => {
    const testKey = `test_vat_${Date.now()}`;
    const [inserted] = await db.insert(smsTemplates).values({
      key: testKey,
      name: "টেস্ট ভ্যাট টেম্পলেট",
      body: "টেস্ট সাবমিশন {{submission_id}}",
      variables: [{ name: "submission_id", label: "আইডি", sample: "123" }],
      isActive: true
    }).returning();

    expect(inserted.id).toBeDefined();
    expect(inserted.key).toBe(testKey);

    const found = await db.query.smsTemplates.findFirst({
      where: eq(smsTemplates.id, inserted.id)
    });

    expect(found?.name).toBe("টেস্ট ভ্যাট টেম্পলেট");

    // Clean up
    await db.delete(smsTemplates).where(eq(smsTemplates.id, inserted.id));
  });

  it("should insert delivery log in sms_logs", async () => {
    const [log] = await db.insert(smsLogs).values({
      recipientMobile: "8801711967548",
      message: "আপনার জুলাই ২০২৬ ভ্যাট রিটার্ন দাখিল হয়েছে।",
      templateKey: "vat_submission",
      submissionId: "VAT-TEST-001",
      status: "SENT",
      providerResponse: "202 Accepted"
    }).returning();

    expect(log.id).toBeDefined();
    expect(log.status).toBe("SENT");

    // Clean up
    await db.delete(smsLogs).where(eq(smsLogs.id, log.id));
  });
});
