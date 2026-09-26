import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { subscriptionMiddleware } from "@/middlewares/subscription-middleware.js";
import { users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";
import {
  listBills,
  getBillDetails,
  createBill,
  batchGenerateBills,
  getMissingBills,
  getClientBillingOverview,
  updateBill,
  deleteBill,
  listCollections,
  createCollection,
  cancelCollection
} from "../controllers/billing.controller.js";
import {
  createBillSchema,
  batchGenerateBillsSchema,
  updateBillSchema,
  createCollectionSchema,
  listBillsQuerySchema,
  listCollectionsQuerySchema,
  clientBillingSummaryQuerySchema
} from "../controllers/billing.schema.js";

export const billingRouter = new Hono();

// Auth & Plan Capability Gating Middleware
billingRouter.use("*", authMiddleware, subscriptionMiddleware, async (c: any, next: any) => {
  const auth = c.get("auth") as any;
  if (!auth?.id) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, auth.id),
    with: { role: true }
  });

  const roleName = currentUser?.role?.name?.toLowerCase();
  if (roleName === "superadmin") {
    return await next();
  }

  const tenantAdminId = currentUser?.adminId || currentUser?.id;
  if (tenantAdminId) {
    const tenantAdmin = await db.query.users.findFirst({
      where: eq(users.id, tenantAdminId)
    });
    if (tenantAdmin?.planId) {
      const [plan] = await db.select().from(plans).where(eq(plans.id, tenantAdmin.planId));
      if (plan && plan.hasAccounts === false) {
        return c.json(
          {
            message: `Account & Billing access is not included in your current plan (${plan.name}). Please upgrade your subscription plan to access Billing & Collections.`
          },
          403
        );
      }
    }
  }

  return await next();
});

// ── COLLECTIONS ENDPOINTS (Register before /:id wildcard) ─────────────
billingRouter.get("/collections", zValidator("query", listCollectionsQuerySchema), listCollections);
billingRouter.post("/collections", zValidator("json", createCollectionSchema), createCollection);
billingRouter.delete("/collections/:id", cancelCollection);

// ── OVERVIEW & MISSING BILLS (Register before /:id wildcard) ──────────
billingRouter.get("/overview", zValidator("query", clientBillingSummaryQuerySchema), getClientBillingOverview);
billingRouter.get("/missing", zValidator("query", listBillsQuerySchema), getMissingBills);

// ── BILL INVOICES ENDPOINTS ──────────────────────────────────────────
billingRouter.get("/", zValidator("query", listBillsQuerySchema), listBills);
billingRouter.post("/", zValidator("json", createBillSchema), createBill);
billingRouter.post("/batch", zValidator("json", batchGenerateBillsSchema), batchGenerateBills);
billingRouter.get("/:id", getBillDetails);
billingRouter.put("/:id", zValidator("json", updateBillSchema), updateBill);
billingRouter.delete("/:id", deleteBill);

export default billingRouter;
