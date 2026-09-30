import type { Context } from "hono";
import { db } from "@/framework/facade.js";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { smsTemplates } from "../database/models/sms_templates.js";
import { smsLogs } from "../database/models/sms_logs.js";
import { companySettings } from "@/modules/firm/database/models/company_settings.js";
import {
  DEFAULT_TEMPLATES,
  renderTemplate,
  callBulkSmsBd,
  normalizeBdMobile
} from "../services/sms.service.js";

function getAuthUser(c: Context): any {
  return c.get("auth") || c.get("user") || (c.req as any).user;
}

function resolveTenantAdminId(user: any): number | null {
  if (!user) return null;
  const roleName = typeof user.role === "string" ? user.role : user.role?.name;
  if (roleName === "superadmin") return null;
  if (roleName === "admin" || !user.adminId) {
    return user.id;
  }
  return user.adminId;
}

function isSuperAdmin(user: any): boolean {
  if (!user) return false;
  const roleName = typeof user.role === "string" ? user.role : user.role?.name;
  return roleName === "superadmin";
}

// 1. List Templates (with tenant isolation or superadmin master view)
export async function listTemplates(c: Context) {
  try {
    const user = getAuthUser(c);
    const superAdmin = isSuperAdmin(user);
    const adminId = superAdmin ? null : resolveTenantAdminId(user);

    // 1. Ensure global master templates exist in DB
    const globalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(smsTemplates)
      .where(isNull(smsTemplates.adminId));

    if (Number(globalCount[0]?.count || 0) === 0) {
      for (const def of DEFAULT_TEMPLATES) {
        await db.insert(smsTemplates).values({
          adminId: null,
          key: def.key,
          name: def.name,
          description: def.description,
          body: def.body,
          variables: def.variables,
          isActive: true
        }).catch(() => {});
      }
    }

    let templates: any[] = [];

    // 2. If tenant admin / staff, query tenant-specific templates
    if (adminId) {
      templates = await db.query.smsTemplates.findMany({
        where: eq(smsTemplates.adminId, adminId),
        orderBy: [smsTemplates.id]
      });

      // Auto-seed for this tenant if first time opening
      if (templates.length === 0) {
        for (const def of DEFAULT_TEMPLATES) {
          await db.insert(smsTemplates).values({
            adminId: adminId,
            key: def.key,
            name: def.name,
            description: def.description,
            body: def.body,
            variables: def.variables,
            isActive: true
          }).catch(() => {});
        }

        templates = await db.query.smsTemplates.findMany({
          where: eq(smsTemplates.adminId, adminId),
          orderBy: [smsTemplates.id]
        });
      }
    } else {
      // Global master templates (SuperAdmin)
      templates = await db.query.smsTemplates.findMany({
        where: isNull(smsTemplates.adminId),
        orderBy: [smsTemplates.id]
      });
    }

    // Fallback in case of empty
    if (!templates || templates.length === 0) {
      templates = DEFAULT_TEMPLATES.map((t, idx) => ({
        id: idx + 1,
        adminId: adminId ?? null,
        key: t.key,
        name: t.name,
        description: t.description,
        body: t.body,
        variables: t.variables,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }

    return c.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    return c.json({
      success: true,
      data: DEFAULT_TEMPLATES.map((t, idx) => ({
        id: idx + 1,
        adminId: null,
        key: t.key,
        name: t.name,
        description: t.description,
        body: t.body,
        variables: t.variables,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
    });
  }
}

// 2. Update Template Body & Status
export async function updateTemplate(c: Context) {
  try {
    const user = getAuthUser(c);
    const id = Number(c.req.param("id"));
    const body = await c.req.json();

    if (!id || Number.isNaN(id)) {
      return c.json({ success: false, message: "Invalid template ID" }, 400);
    }

    const superAdmin = isSuperAdmin(user);
    const adminId = superAdmin ? null : resolveTenantAdminId(user);

    let existing = await db.query.smsTemplates.findFirst({
      where: eq(smsTemplates.id, id)
    });

    if (!existing) {
      return c.json({ success: false, message: "Template not found" }, 404);
    }

    const updateData: any = {
      updatedAt: new Date()
    };
    if (typeof body.body === "string" && body.body.trim()) {
      updateData.body = body.body.trim();
    }
    if (typeof body.isActive === "boolean") {
      updateData.isActive = body.isActive;
    }
    if (typeof body.name === "string" && body.name.trim()) {
      updateData.name = body.name.trim();
    }

    await db.update(smsTemplates).set(updateData).where(eq(smsTemplates.id, id));

    const updated = await db.query.smsTemplates.findFirst({
      where: eq(smsTemplates.id, id)
    });

    return c.json({
      success: true,
      message: "Template updated successfully",
      data: updated
    });
  } catch (error: any) {
    return c.json({ success: false, message: error?.message || "Failed to update template" }, 500);
  }
}

// 3. Reset Template to Default
export async function resetTemplate(c: Context) {
  try {
    const id = Number(c.req.param("id"));

    const existing = await db.query.smsTemplates.findFirst({
      where: eq(smsTemplates.id, id)
    });

    if (!existing) {
      return c.json({ success: false, message: "Template not found" }, 404);
    }

    const def = DEFAULT_TEMPLATES.find((t) => t.key === existing.key);
    if (!def) {
      return c.json({ success: false, message: "No default template found for this key" }, 400);
    }

    await db.update(smsTemplates).set({
      body: def.body,
      name: def.name,
      description: def.description,
      variables: def.variables,
      isActive: true,
      updatedAt: new Date()
    }).where(eq(smsTemplates.id, id));

    const updated = await db.query.smsTemplates.findFirst({
      where: eq(smsTemplates.id, id)
    });

    return c.json({
      success: true,
      message: "Template reset to default successfully",
      data: updated
    });
  } catch (error: any) {
    return c.json({ success: false, message: error?.message || "Failed to reset template" }, 500);
  }
}

// 4. Send Test SMS
export async function sendTestSms(c: Context) {
  try {
    const user = getAuthUser(c);
    const body = await c.req.json();
    const { recipientMobile, message } = body;

    if (!recipientMobile || !message) {
      return c.json({ success: false, message: "Recipient number and message are required" }, 400);
    }

    const recipient = normalizeBdMobile(recipientMobile);
    if (!recipient) {
      return c.json({ success: false, message: "Invalid Bangladesh mobile number format (e.g. 017XXXXXXXX)" }, 400);
    }

    const adminId = resolveTenantAdminId(user);
    const settings = await db.query.companySettings.findFirst({
      where: adminId ? eq(companySettings.adminId, adminId) : undefined
    });

    if (!settings?.smsApiKey || !settings?.senderId) {
      return c.json({
        success: false,
        message: "SMS Gateway API Key or Sender ID is missing in Firm Settings. Please configure them first."
      }, 400);
    }

    const result = await callBulkSmsBd({
      apiKey: settings.smsApiKey,
      senderId: settings.senderId,
      number: recipient,
      message: message.trim()
    });

    await db.insert(smsLogs).values({
      adminId: adminId ?? null,
      recipientMobile: recipient,
      message: message.trim(),
      templateKey: "test_sms",
      status: result.ok ? "SENT" : "FAILED",
      providerResponse: result.raw,
      sentBy: user?.id ?? null
    }).catch(() => {});

    if (result.ok) {
      return c.json({ success: true, message: "Test SMS sent successfully!", response: result.raw });
    }
    return c.json({ success: false, message: `Failed to send SMS: ${result.raw}`, response: result.raw }, 400);
  } catch (error: any) {
    return c.json({ success: false, message: error?.message || "Error sending test SMS" }, 500);
  }
}

// 5. List Delivery Logs
export async function listSmsLogs(c: Context) {
  try {
    const user = getAuthUser(c);
    const superAdmin = isSuperAdmin(user);
    const adminId = superAdmin ? null : resolveTenantAdminId(user);

    const logs = await db.query.smsLogs.findMany({
      where: superAdmin || !adminId ? undefined : eq(smsLogs.adminId, adminId),
      orderBy: [desc(smsLogs.sentAt)],
      limit: 50
    });

    return c.json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    return c.json({ success: false, message: error?.message || "Failed to fetch SMS logs" }, 500);
  }
}
