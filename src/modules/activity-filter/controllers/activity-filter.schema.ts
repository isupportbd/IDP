import { z } from "@/framework/facade.js";

export const QueryActivityFilterSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Tax period must be in YYYY-MM format")
    .optional(),
  taxPeriod: z.string().optional(),
  search: z.string().optional(),
  clientTypeId: z.coerce.number().optional(),
  referenceId: z.coerce.number().optional(),
  status: z
    .enum([
      "all",
      "active",
      "inactive",
      "active_filed",
      "active_unfiled",
      "inactive_filed",
      "inactive_unfiled",
      "total_filed",
      "total_unfiled"
    ])
    .optional()
    .default("all")
});

export type QueryActivityFilter = z.infer<typeof QueryActivityFilterSchema>;
