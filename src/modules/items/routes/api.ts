import { Hono } from "hono";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { getItems, bulkCreateItems } from "../controllers/items.controller.js";

const itemsRouter = new Hono();

itemsRouter.use("*", authMiddleware);

itemsRouter.get("/", getItems);
itemsRouter.post("/bulk", bulkCreateItems);

export default itemsRouter;
