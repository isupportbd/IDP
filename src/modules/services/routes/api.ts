import { createRoute, createRouter, HttpStatusCodes, jsonContent, z } from "@/framework/facade.js";
import {
  listCustomerTypes,
  createCustomerType,
  toggleCustomerType,
  listReferences,
  createReference,
  updateReference,
  deleteReference,
  toggleReference,
  listServiceItems,
  createServiceItem,
  updateServiceItem,
  toggleServiceItem,
  deleteServiceItem,
  listServiceRates,
  createServiceRate,
  updateServiceRate,
  deleteServiceRate
} from "../controllers/services.controller.js";
import {
  CreateCustomerTypeSchema,
  CreateReferenceSchema,
  UpdateReferenceSchema,
  CreateServiceItemSchema,
  UpdateServiceItemSchema,
  CreateServiceRateSchema,
  UpdateServiceRateSchema,
  IdParamSchema
} from "../controllers/services.schema.js";

// ── CUSTOMER TYPES ROUTES ───────────────────────────────────────────

const getCustomerTypesRoute = createRoute({
  path: "/customer-types",
  method: "get",
  tags: ["Services"],
  description: "List all customer types",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.array(z.any()) }), "Customer types list")
  }
});

const postCustomerTypeRoute = createRoute({
  path: "/customer-types",
  method: "post",
  tags: ["Services"],
  description: "Create customer type",
  request: {
    body: jsonContent(CreateCustomerTypeSchema, "Customer type payload")
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Created customer type")
  }
});

const toggleCustomerTypeRoute = createRoute({
  path: "/customer-types/{id}/toggle",
  method: "patch",
  tags: ["Services"],
  description: "Toggle customer type status",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Updated customer type")
  }
});

// ── REFERENCES ROUTES ───────────────────────────────────────────────

const getReferencesRoute = createRoute({
  path: "/references",
  method: "get",
  tags: ["Services"],
  description: "List all client references",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.array(z.any()) }), "References list")
  }
});

const postReferenceRoute = createRoute({
  path: "/references",
  method: "post",
  tags: ["Services"],
  description: "Create client reference",
  request: {
    body: jsonContent(CreateReferenceSchema, "Reference payload")
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Created reference")
  }
});

const patchReferenceRoute = createRoute({
  path: "/references/{id}",
  method: "patch",
  tags: ["Services"],
  description: "Update client reference",
  request: {
    params: IdParamSchema,
    body: jsonContent(UpdateReferenceSchema, "Reference update payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Updated reference")
  }
});

const toggleReferenceRoute = createRoute({
  path: "/references/{id}/toggle",
  method: "patch",
  tags: ["Services"],
  description: "Toggle reference active status",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Updated reference")
  }
});

const deleteReferenceRoute = createRoute({
  path: "/references/{id}",
  method: "delete",
  tags: ["Services"],
  description: "Delete reference",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string() }), "Deleted reference response")
  }
});

// ── SERVICE ITEMS ROUTES ────────────────────────────────────────────

const getServiceItemsRoute = createRoute({
  path: "/items",
  method: "get",
  tags: ["Services"],
  description: "List all billable service items",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.array(z.any()) }), "Service items list")
  }
});

const postServiceItemRoute = createRoute({
  path: "/items",
  method: "post",
  tags: ["Services"],
  description: "Create service item",
  request: {
    body: jsonContent(CreateServiceItemSchema, "Service item payload")
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Created service item")
  }
});

const patchServiceItemRoute = createRoute({
  path: "/items/{id}",
  method: "patch",
  tags: ["Services"],
  description: "Update service item",
  request: {
    params: IdParamSchema,
    body: jsonContent(UpdateServiceItemSchema, "Service item update payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Updated service item")
  }
});

const toggleServiceItemRoute = createRoute({
  path: "/items/{id}/toggle",
  method: "patch",
  tags: ["Services"],
  description: "Toggle service item status",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Updated service item")
  }
});

const deleteServiceItemRoute = createRoute({
  path: "/items/{id}",
  method: "delete",
  tags: ["Services"],
  description: "Delete service item",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string() }), "Deleted service item response")
  }
});

// ── SERVICE RATES ROUTES ────────────────────────────────────────────

const getServiceRatesRoute = createRoute({
  path: "/rates",
  method: "get",
  tags: ["Services"],
  description: "List all configured service rates",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.array(z.any()) }), "Service rates list")
  }
});

const postServiceRateRoute = createRoute({
  path: "/rates",
  method: "post",
  tags: ["Services"],
  description: "Create or set service rate",
  request: {
    body: jsonContent(CreateServiceRateSchema, "Service rate payload")
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Created service rate")
  }
});

const patchServiceRateRoute = createRoute({
  path: "/rates/{id}",
  method: "patch",
  tags: ["Services"],
  description: "Update service rate",
  request: {
    params: IdParamSchema,
    body: jsonContent(UpdateServiceRateSchema, "Service rate update payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Updated service rate")
  }
});

const deleteServiceRateRoute = createRoute({
  path: "/rates/{id}",
  method: "delete",
  tags: ["Services"],
  description: "Delete service rate",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string() }), "Deleted service rate response")
  }
});

// ── ROUTER EXPORT ───────────────────────────────────────────────────

export default createRouter()
  .api(getCustomerTypesRoute, [], listCustomerTypes)
  .api(postCustomerTypeRoute, [], createCustomerType)
  .api(toggleCustomerTypeRoute, [], toggleCustomerType)
  .api(getReferencesRoute, [], listReferences)
  .api(postReferenceRoute, [], createReference)
  .api(patchReferenceRoute, [], updateReference)
  .api(toggleReferenceRoute, [], toggleReference)
  .api(deleteReferenceRoute, [], deleteReference)
  .api(getServiceItemsRoute, [], listServiceItems)
  .api(postServiceItemRoute, [], createServiceItem)
  .api(patchServiceItemRoute, [], updateServiceItem)
  .api(toggleServiceItemRoute, [], toggleServiceItem)
  .api(deleteServiceItemRoute, [], deleteServiceItem)
  .api(getServiceRatesRoute, [], listServiceRates)
  .api(postServiceRateRoute, [], createServiceRate)
  .api(patchServiceRateRoute, [], updateServiceRate)
  .api(deleteServiceRateRoute, [], deleteServiceRate);
