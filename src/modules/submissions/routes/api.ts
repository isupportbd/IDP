import { createRoute, createRouter, HttpStatusCodes, jsonContent, z } from "@/framework/facade.js";
import {
  listSubmissions,
  recordSubmission,
  deleteSubmission,
  batchDeleteSubmissions
} from "../controllers/submissions.controller.js";
import {
  RecordSubmissionSchema,
  QuerySubmissionsSchema,
  BatchDeleteSubmissionsSchema,
  IdParamSchema
} from "../controllers/submissions.schema.js";

// ── 1. LIST SUBMISSIONS ──────────────────────────────────────────────

const getSubmissionsRoute = createRoute({
  path: "/",
  method: "get",
  tags: ["Submissions"],
  description: "List active client return submissions with statistics",
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

// ── 2. RECORD / UPSERT SUBMISSION ID ─────────────────────────────────

const postSubmissionRoute = createRoute({
  path: "/",
  method: "post",
  tags: ["Submissions"],
  description: "Record or update submission ID for a client",
  request: {
    body: jsonContent(RecordSubmissionSchema, "Submission payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        data: z.any()
      }),
      "Submission record response"
    )
  }
});

// ── 3. DELETE SUBMISSION RECORD ──────────────────────────────────────

const deleteSubmissionRoute = createRoute({
  path: "/{id}",
  method: "delete",
  tags: ["Submissions"],
  description: "Delete submission record",
  request: {
    params: IdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string()
      }),
      "Submission deleted response"
    )
  }
});

// ── 4. BATCH DELETE SUBMISSIONS ──────────────────────────────────────

const batchDeleteSubmissionsRoute = createRoute({
  path: "/batch-delete",
  method: "post",
  tags: ["Submissions"],
  description: "Batch delete submissions",
  request: {
    body: jsonContent(BatchDeleteSubmissionsSchema, "Batch delete payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string()
      }),
      "Batch delete response"
    )
  }
});

export default createRouter()
  .api(getSubmissionsRoute, [], listSubmissions)
  .api(postSubmissionRoute, [], recordSubmission)
  .api(batchDeleteSubmissionsRoute, [], batchDeleteSubmissions)
  .api(deleteSubmissionRoute, [], deleteSubmission);
