import type { Context, Next } from "hono";
import { createRouter } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import {
  listTemplates,
  updateTemplate,
  resetTemplate,
  sendTestSms,
  listSmsLogs,
  getGatewaySettings,
  updateGatewaySettings,
  checkGatewayBalance
} from "../controllers/sms-templates.controller.js";

const smsTemplatesRouter = createRouter();

/**
 * SuperAdmin only — global master template management.
 * Admin/Staff are blocked from editing the master template defaults.
 */
async function superAdminOnlyMiddleware(c: Context, next: Next) {
  const auth = c.get("auth") || c.get("user") || (c.req as any).user;
  const roleName = typeof auth?.role === "string" ? auth.role : auth?.role?.name;
  if (roleName !== "superadmin") {
    return c.json({ success: false, message: "Forbidden: Super Admin access only" }, 403);
  }
  return await next();
}

/**
 * Authenticated users (superadmin + admin + staff).
 * Each user sees only their own tenant's data via resolveTenantAdminId() in the controller.
 * - SuperAdmin  → adminId = null  → global gateway & templates
 * - Admin       → adminId = user.id → own gateway & templates
 * - Staff       → adminId = user.adminId → admin's gateway & templates
 */
smsTemplatesRouter.use("*", authMiddleware);

// ── Gateway settings & actions: accessible by all authenticated roles ──
// Controller isolates data per tenant via resolveTenantAdminId()
smsTemplatesRouter.get("/gateway", getGatewaySettings);
smsTemplatesRouter.put("/gateway", updateGatewaySettings);
smsTemplatesRouter.get("/gateway/balance", checkGatewayBalance);
smsTemplatesRouter.post("/test", sendTestSms);
smsTemplatesRouter.get("/logs", listSmsLogs);

// ── Template management: SuperAdmin only ──────────────────────────────────
// Admins use global templates for SMS sending; they do NOT manage templates.
smsTemplatesRouter.get("/", superAdminOnlyMiddleware, listTemplates);
smsTemplatesRouter.put("/:id", superAdminOnlyMiddleware, updateTemplate);
smsTemplatesRouter.post("/:id/reset", superAdminOnlyMiddleware, resetTemplate);

export default smsTemplatesRouter;
