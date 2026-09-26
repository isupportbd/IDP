import { Hono } from "hono";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import {
  getMonthlySummary,
  getSalesReport,
  getStatementReport
} from "../controllers/reports.controller.js";

const reportsRouter = new Hono();

reportsRouter.use("*", authMiddleware);

reportsRouter.get("/monthly-summary", getMonthlySummary);
reportsRouter.get("/sales", getSalesReport);
reportsRouter.get("/statement", getStatementReport);

export default reportsRouter;
