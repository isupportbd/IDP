import { z } from "@/framework/facade.js";

// ── Customer Types ─────────────────────────
export const CustomerTypeItemSchema = z.object({
  id: z.number(),
  typeName: z.string(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date())
});

export const CreateCustomerTypeSchema = z.object({
  typeName: z.string().trim().min(1, "Customer type name is required"),
  description: z.string().trim().optional(),
  isActive: z.boolean().default(true)
});

// ── References ──────────────────────────────
export const CreateReferenceSchema = z.object({
  name: z.string().trim().min(1, "Reference name is required"),
  phone: z.string().trim().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  notes: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true)
});

export const UpdateReferenceSchema = CreateReferenceSchema.partial();

// ── Service Items ──────────────────────────
export const ServiceItemSchema = z.object({
  id: z.number(),
  itemName: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date())
});

export const CreateServiceItemSchema = z.object({
  itemName: z.string().trim().min(1, "Service item name is required").max(100, "Name too long"),
  isActive: z.boolean().default(true)
});

export const UpdateServiceItemSchema = z.object({
  itemName: z.string().trim().min(1, "Service item name is required").max(100, "Name too long").optional(),
  isActive: z.boolean().optional()
});

// ── Service Rates ──────────────────────────
export const ServiceRateItemSchema = z.object({
  id: z.number(),
  serviceItemId: z.number(),
  customerTypeId: z.number().nullable().optional(),
  regularRate: z.number(),
  minimumCharge: z.number(),
  effectiveFrom: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  serviceItem: z.object({
    id: z.number(),
    itemName: z.string()
  }).optional(),
  customerType: z.object({
    id: z.number(),
    typeName: z.string()
  }).nullable().optional()
});

export const CreateServiceRateSchema = z.object({
  serviceItemId: z.coerce.number().int().positive("Select a valid service item"),
  customerTypeId: z.coerce.number().int().positive().nullable().optional(),
  unit: z.string().max(50).default("Month").optional(),
  regularRate: z.coerce.number().min(0, "Rate cannot be negative"),
  minimumCharge: z.coerce.number().min(0, "Minimum charge cannot be negative").default(0),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD")
});

export const UpdateServiceRateSchema = CreateServiceRateSchema.partial();

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
