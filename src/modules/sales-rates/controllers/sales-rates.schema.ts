import { z } from "@/framework/facade.js";

export const CreateSalesRateSchema = z.object({
  clientId: z.coerce.number(),
  itemId: z.coerce.number(),
  unitId: z.coerce.number().nullable().optional(),
  salesRate: z.coerce.number(),
  vatRate: z.coerce.number(),
  vatableValue: z.coerce.number().optional(),
  additionPercent: z.coerce.number().default(0).optional(),
  activationDate: z.string(),
  status: z.enum(["Active", "Frozen"]).default("Active").optional()
});

export const UpdateSalesRateSchema = z.object({
  clientId: z.coerce.number().optional(),
  itemId: z.coerce.number().optional(),
  unitId: z.coerce.number().nullable().optional(),
  salesRate: z.coerce.number().optional(),
  vatRate: z.coerce.number().optional(),
  vatableValue: z.coerce.number().optional(),
  additionPercent: z.coerce.number().optional(),
  activationDate: z.string().optional(),
  status: z.enum(["Active", "Frozen"]).optional()
});

export const ListSalesRatesQuerySchema = z.object({
  page: z.coerce.number().default(1).optional(),
  limit: z.coerce.number().default(10).optional(),
  search: z.string().optional(),
  clientFilter: z.string().optional(),
  itemFilter: z.string().optional(),
  rateFilter: z.string().optional(),
  clientId: z.coerce.number().optional(),
  itemId: z.coerce.number().optional(),
  status: z.string().optional()
});

export const IdParamSchema = z.object({
  id: z.coerce.number()
});
