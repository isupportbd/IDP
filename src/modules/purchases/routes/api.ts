import { Hono } from "hono";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { subscriptionMiddleware } from "@/middlewares/subscription-middleware.js";
import {
  listPurchases,
  deletePurchase,
  batchDeletePurchases,
  deletePurchasesByMonth,
  getPurchasesMonths
} from "../controllers/purchases.controller.js";

const purchasesRouter = new Hono();

purchasesRouter.use("*", authMiddleware, subscriptionMiddleware);

purchasesRouter.get("/months", getPurchasesMonths);
purchasesRouter.get("/", listPurchases);
purchasesRouter.delete("/month/:month", deletePurchasesByMonth);
purchasesRouter.delete("/:id", deletePurchase);
purchasesRouter.post("/batch-delete", batchDeletePurchases);

export default purchasesRouter;

