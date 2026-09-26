import { z } from "@/framework/facade.js";

export const RecordSubmissionSchema = z.object({
  clientId: z.number().int().positive("Valid client ID is required"),
  taxPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Tax period must be in YYYY-MM format (e.g. 2026-08)"),
  submissionId: z.string().min(1, "Submission ID is required").max(100),
  submittedBy: z.number().int().positive().optional(),
  submittedAt: z.string().optional(),
  remarks: z.string().max(1000).optional()
});

export const QuerySubmissionsSchema = z.object({
  month: z.string().optional(),
  taxPeriod: z.string().optional(),
  customerTypeId: z.string().optional(),
  referenceId: z.string().optional(),
  managerId: z.string().optional(),
  status: z.enum(["all", "submitted", "pending", "late_submitted"]).optional(),
  search: z.string().optional()
});

export const BatchDeleteSubmissionsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "At least one ID is required")
});

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid ID parameter")
});
