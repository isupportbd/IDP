import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getActivityMatrix } from "../controllers/activity-filter.controller.js";
import { QueryActivityFilterSchema } from "../controllers/activity-filter.schema.js";

export const activityFilterRouter = new Hono();

// ── GET ACTIVITY FILTER MATRIX ──────────────────────────────────────
activityFilterRouter.get("/", zValidator("query", QueryActivityFilterSchema), getActivityMatrix);

export default activityFilterRouter;
