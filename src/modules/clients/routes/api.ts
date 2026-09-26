import { createRoute, createRouter, HttpStatusCodes, jsonContent, z } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { subscriptionMiddleware } from "@/middlewares/subscription-middleware.js";
import {
  listClients,
  getClientById,
  createClient,
  updateClient,
  toggleClientStatus,
  deleteClient,
  checkBinUnique,
  checkMobileExists,
  listAssignments,
  assignManagers,
  listAssignableUsers,
  bulkCreateClients,
  getClientPurchasedItems
} from "../controllers/clients.controller.js";
import {
  listSubmissions,
  recordSubmission,
  deleteSubmission,
  batchDeleteSubmissions
} from "@/modules/submissions/controllers/submissions.controller.js";
import {
  RecordSubmissionSchema,
  QuerySubmissionsSchema,
  BatchDeleteSubmissionsSchema
} from "@/modules/submissions/controllers/submissions.schema.js";
import {
  IdParamSchema,
  CreateClientSchema,
  UpdateClientSchema,
  ToggleClientSchema,
  CheckBinSchema,
  CheckMobileSchema,
  AssignManagersSchema,
  ListAssignmentsQuerySchema,
  ListClientsQuerySchema
} from "../controllers/clients.schema.js";

// ── USERS FOR ASSIGNMENT ─────────────────────────────────────────────

const getUsersRoute = createRoute({
  path: "/users",
  method: "get",
  tags: ["Clients"],
  description: "List all users available for client assignment",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.array(z.any()) }), "Users list")
  }
});

// ── ASSIGNMENTS ROUTES ───────────────────────────────────────────────

const getAssignmentsRoute = createRoute({
  path: "/assignments",
  method: "get",
  tags: ["Clients"],
  description: "List all clients with their assigned managers",
  request: {
    query: ListAssignmentsQuerySchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.array(z.any()) }), "Assignments list")
  }
});

const postAssignmentsRoute = createRoute({
  path: "/assignments",
  method: "post",
  tags: ["Clients"],
  description: "Assign managers to a client",
  request: {
    body: jsonContent(AssignManagersSchema, "Assignment payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string() }), "Assignment saved response")
  }
});

// ── VALIDATION CHECKS ────────────────────────────────────────────────

const checkBinRoute = createRoute({
  path: "/check-bin",
  method: "post",
  tags: ["Clients"],
  description: "Check if BIN number is unique",
  request: {
    body: jsonContent(CheckBinSchema, "Check BIN payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ unique: z.boolean(), existingClient: z.any().nullable() }), "BIN check response")
  }
});

const checkMobileRoute = createRoute({
  path: "/check-mobile",
  method: "post",
  tags: ["Clients"],
  description: "Check for clients with matching mobile",
  request: {
    body: jsonContent(CheckMobileSchema, "Check mobile payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ matches: z.array(z.any()) }), "Mobile check response")
  }
});

// ── CLIENTS CRUD ROUTES ──────────────────────────────────────────────

const getClientsRoute = createRoute({
  path: "/",
  method: "get",
  tags: ["Clients"],
  description: "List clients with filtering, search, and pagination",
  request: {
    query: ListClientsQuerySchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.array(z.any()), pagination: z.any() }), "Clients list")
  }
});

const getClientByIdRoute = createRoute({
  path: "/{id}",
  method: "get",
  tags: ["Clients"],
  description: "Get single client by ID",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Client details")
  }
});

const getClientItemsRoute = createRoute({
  path: "/{id}/items",
  method: "get",
  tags: ["Clients"],
  description: "Get distinct purchased items for a specific client",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.array(z.any()) }), "Client purchased items")
  }
});

const postBulkClientsRoute = createRoute({
  path: "/bulk",
  method: "post",
  tags: ["Clients"],
  description: "Bulk upload multiple client organizations",
  request: {
    body: jsonContent(z.object({ clients: z.array(z.any()) }), "Bulk client payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), createdCount: z.number(), skippedCount: z.number().optional() }), "Bulk clients created")
  }
});

const postClientRoute = createRoute({
  path: "/",
  method: "post",
  tags: ["Clients"],
  description: "Create a new client",
  request: {
    body: jsonContent(CreateClientSchema, "Client payload")
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Client created")
  }
});

const patchClientRoute = createRoute({
  path: "/{id}",
  method: "patch",
  tags: ["Clients"],
  description: "Update client details",
  request: {
    params: IdParamSchema,
    body: jsonContent(UpdateClientSchema, "Update client payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Client updated")
  }
});

const patchToggleClientRoute = createRoute({
  path: "/{id}/toggle",
  method: "patch",
  tags: ["Clients"],
  description: "Toggle client active status",
  request: {
    params: IdParamSchema,
    body: jsonContent(ToggleClientSchema, "Toggle status payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Status updated")
  }
});

const deleteClientRoute = createRoute({
  path: "/{id}",
  method: "delete",
  tags: ["Clients"],
  description: "Delete client",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string() }), "Client deleted response")
  }
});

// ── SUBMISSIONS ROUTES ───────────────────────────────────────────────

const getSubmissionsRoute = createRoute({
  path: "/submissions",
  method: "get",
  tags: ["Submissions"],
  description: "List return submissions",
  request: {
    query: QuerySubmissionsSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        data: z.array(z.any()),
        stats: z.object({
          totalActive: z.number(),
          submittedCount: z.number(),
          pendingCount: z.number(),
          lateSubmittedCount: z.number()
        })
      }),
      "Submissions dataset"
    )
  }
});

const postSubmissionRoute = createRoute({
  path: "/submissions",
  method: "post",
  tags: ["Submissions"],
  description: "Record submission ID",
  request: {
    body: jsonContent(RecordSubmissionSchema, "Submission payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string(), data: z.any() }), "Submission record response")
  }
});

const batchDeleteSubmissionsRoute = createRoute({
  path: "/submissions/batch-delete",
  method: "post",
  tags: ["Submissions"],
  description: "Batch delete submissions",
  request: {
    body: jsonContent(BatchDeleteSubmissionsSchema, "Batch delete payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string() }), "Batch delete response")
  }
});

const deleteSubmissionRoute = createRoute({
  path: "/submissions/{id}",
  method: "delete",
  tags: ["Submissions"],
  description: "Delete submission record",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string() }), "Submission deleted response")
  }
});

// ── ROUTER EXPORT ────────────────────────────────────────────────────

export default createRouter()
  .group(authMiddleware, subscriptionMiddleware)
  .api(getUsersRoute, [], listAssignableUsers)
  .api(getAssignmentsRoute, [], listAssignments)
  .api(postAssignmentsRoute, [], assignManagers)
  .api(getSubmissionsRoute, [], listSubmissions)
  .api(postSubmissionRoute, [], recordSubmission)
  .api(batchDeleteSubmissionsRoute, [], batchDeleteSubmissions)
  .api(deleteSubmissionRoute, [], deleteSubmission)
  .api(checkBinRoute, [], checkBinUnique)
  .api(checkMobileRoute, [], checkMobileExists)
  .api(getClientsRoute, [], listClients)
  .api(getClientByIdRoute, [], getClientById)
  .api(getClientItemsRoute, [], getClientPurchasedItems)
  .api(postBulkClientsRoute, [], bulkCreateClients)
  .api(postClientRoute, [], createClient)
  .api(patchClientRoute, [], updateClient)
  .api(patchToggleClientRoute, [], toggleClientStatus)
  .api(deleteClientRoute, [], deleteClient);

