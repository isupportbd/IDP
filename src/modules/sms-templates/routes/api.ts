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

// Apply auth middleware to all SMS routes
smsTemplatesRouter.use("*", authMiddleware);

smsTemplatesRouter.get("/gateway", getGatewaySettings);
smsTemplatesRouter.put("/gateway", updateGatewaySettings);
smsTemplatesRouter.get("/gateway/balance", checkGatewayBalance);
smsTemplatesRouter.get("/", listTemplates);
smsTemplatesRouter.get("/logs", listSmsLogs);
smsTemplatesRouter.put("/:id", updateTemplate);
smsTemplatesRouter.post("/:id/reset", resetTemplate);
smsTemplatesRouter.post("/test", sendTestSms);

export default smsTemplatesRouter;
