import { Hono } from "hono";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { processUpload, savePurchases, replaceDuplicate, savePendingFfs } from "../controllers/upload.controller.js";

const uploadRouter = new Hono({ strict: false });

uploadRouter.use("*", authMiddleware);

uploadRouter.post("/", processUpload);
uploadRouter.post("", processUpload);
uploadRouter.post("/save", savePurchases);
uploadRouter.post("/replace", replaceDuplicate);
uploadRouter.post("/save-pending-ffs", savePendingFfs);

export default uploadRouter;
