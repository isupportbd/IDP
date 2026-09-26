import { z } from "@/framework/facade.js";

export const PlanSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Plan name is required"),
  rateMonthly: z.number().min(0, "Monthly rate must be positive"),
  rateYearly: z.number().min(0, "Yearly rate must be positive"),
  maxUsers: z.number().min(1, "Max users must be at least 1").default(1),
  maxClients: z.number().min(1, "Max clients must be at least 1").default(50),
  maxStorageMB: z.number().min(100, "Max storage must be at least 100 MB").default(1024),
  hasAccounts: z.boolean().default(false),
  yearlyDiscountPercent: z.number().default(0),
  features: z.array(z.string()).default([]),
  status: z.string().default("active")
});

export const ApproveSignupSchema = z.object({
  userId: z.coerce.number(),
  days: z.coerce.number().optional().nullable()
});

export const RejectSignupSchema = z.object({
  userId: z.coerce.number()
});

export const ExtendTenantSchema = z.object({
  days: z.coerce.number().min(1, "Days must be at least 1")
});

export const PaymentSettingsSchema = z.object({
  bkashNumber: z.string().min(1, "bKash number is required"),
  bkashCharge: z.number().min(0).default(1.8),
  nagadNumber: z.string().optional(),
  rocketNumber: z.string().optional()
});
