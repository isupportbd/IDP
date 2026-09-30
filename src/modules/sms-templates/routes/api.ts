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

async function superAdminOnlyMiddleware(c: Context, next: Next) {
  const auth = c.get("auth") || c.get("user") || (c.req as any).user;
  const roleName = typeof auth?.role === "string" ? auth.role : auth?.role?.name;
  if (roleName !== "superadmin") {
    return c.json({ success: false, message: "Forbidden: Super Admin access only" }, 403);
  }
  return await next();
}

// Apply auth middleware and superadmin guard to all SMS routes
smsTemplatesRouter.use("*", authMiddleware, superAdminOnlyMiddleware);

smsTemplatesRouter.get("/gateway", getGatewaySettings);
smsTemplatesRouter.put("/gateway", updateGatewaySettings);
smsTemplatesRouter.get("/gateway/balance", checkGatewayBalance);
smsTemplatesRouter.get("/", listTemplates);
smsTemplatesRouter.get("/logs", listSmsLogs);
smsTemplatesRouter.put("/:id", updateTemplate);
smsTemplatesRouter.post("/:id/reset", resetTemplate);
smsTemplatesRouter.post("/test", sendTestSms);

export default smsTemplatesRouter;
