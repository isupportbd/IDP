import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { subscriptionMiddleware } from "@/middlewares/subscription-middleware.js";
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

// Auth + Subscription + Billing Feature Gate (via subscriptionMiddleware)
// hasAccounts plan check is handled inside subscriptionMiddleware for /billing routes
billingRouter.use("*", authMiddleware, subscriptionMiddleware);

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
