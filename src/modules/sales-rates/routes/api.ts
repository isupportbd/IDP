import { createRoute, createRouter, HttpStatusCodes, jsonContent, z } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { subscriptionMiddleware } from "@/middlewares/subscription-middleware.js";
import {
  listSalesRates,
  createSalesRate,
  updateSalesRate,
  deleteSalesRate,
  getRateHistory
} from "../controllers/sales-rates.controller.js";
import {
  CreateSalesRateSchema,
  UpdateSalesRateSchema,
  ListSalesRatesQuerySchema,
  IdParamSchema
} from "../controllers/sales-rates.schema.js";

// ── GET / (List Sales Rates) ──────────────────────────────────────────
const getSalesRatesRoute = createRoute({
  path: "/",
  method: "get",
  tags: ["Sales Rates"],
  description: "List sales rates with filtering and search",
  request: {
    query: ListSalesRatesQuerySchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
        data: z.array(z.any()),
        total: z.number().optional(),
        pagination: z.any().optional()
      }),
      "Sales rates list"
    )
  }
});

// ── GET /history (Rate History) ───────────────────────────────────────
const getRateHistoryRoute = createRoute({
  path: "/history",
  method: "get",
  tags: ["Sales Rates"],
  description: "Get rate change history for client and item",
  request: {
    query: z.object({
      clientId: z.coerce.number(),
      itemId: z.coerce.number()
    })
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        data: z.array(z.any())
      }),
      "Rate history records"
    )
  }
});

// ── POST / (Create Sales Rate) ────────────────────────────────────────
const postSalesRateRoute = createRoute({
  path: "/",
  method: "post",
  tags: ["Sales Rates"],
  description: "Create a new sales rate",
  request: {
    body: jsonContent(CreateSalesRateSchema, "Sales rate payload")
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
        data: z.any()
      }),
      "Sales rate created"
    )
  }
});

// ── PUT /{id} (Update Sales Rate) ─────────────────────────────────────
const putSalesRateRoute = createRoute({
  path: "/{id}",
  method: "put",
  tags: ["Sales Rates"],
  description: "Update existing sales rate",
  request: {
    params: IdParamSchema,
    body: jsonContent(UpdateSalesRateSchema, "Update payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
        data: z.any()
      }),
      "Sales rate updated"
    )
  }
});

// ── DELETE /{id} (Delete Sales Rate) ──────────────────────────────────
const deleteSalesRateRoute = createRoute({
  path: "/{id}",
  method: "delete",
  tags: ["Sales Rates"],
  description: "Delete sales rate",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string()
      }),
      "Sales rate deleted response"
    )
  }
});

// ── ROUTER EXPORT ─────────────────────────────────────────────────────
export default createRouter()
  .group(authMiddleware, subscriptionMiddleware)
  .api(getSalesRatesRoute, [], listSalesRates)
  .api(getRateHistoryRoute, [], getRateHistory)
  .api(postSalesRateRoute, [], createSalesRate)
  .api(putSalesRateRoute, [], updateSalesRate)
  .api(deleteSalesRateRoute, [], deleteSalesRate);
