import { z } from "@/framework/facade.js";

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const CreateClientSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(255),
  proprietorName: z.string().max(255).optional().nullable(),
  mobile: z.string().max(50).optional().nullable(),
  alternativeMobile: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  binNumber: z.string().max(50).optional().nullable(),
  tinNumber: z.string().max(50).optional().nullable(),
  tradeLicenseNo: z.string().max(100).optional().nullable(),
  customerTypeId: z.coerce.number().int().positive().optional().nullable(),
  referenceId: z.coerce.number().int().positive().optional().nullable(),
  vatUserId: z.string().max(100).optional().nullable(),
  vatPassword: z.string().max(255).optional().nullable(),
  vatServiceType: z.enum(["FULL", "ONLY_RETURN"]).default("FULL"),
  openingBalance: z.coerce.number().default(0).optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  managerIds: z.array(z.coerce.number().int().positive()).optional()
});

export const UpdateClientSchema = CreateClientSchema.partial();

export const ToggleClientSchema = z.object({
  isActive: z.boolean()
});

export const CheckBinSchema = z.object({
  bin: z.string().trim().min(1),
  excludeId: z.coerce.number().int().positive().optional()
});

export const CheckMobileSchema = z.object({
  mobile: z.string().trim().min(1),
  excludeId: z.coerce.number().int().positive().optional()
});

export const AssignManagersSchema = z.object({
  clientId: z.coerce.number().int().positive(),
  managerIds: z.array(z.coerce.number().int().positive())
});

export const ListAssignmentsQuerySchema = z.object({
  search: z.string().optional(),
  filter: z.enum(["all", "assigned", "shared", "unassigned"]).optional().default("all")
});

export const ListClientsQuerySchema = z.object({
  search: z.string().optional(),
  customerTypeId: z.coerce.number().int().positive().optional(),
  referenceId: z.coerce.number().int().positive().optional(),
  isActive: z.enum(["true", "false", "all"]).optional().default("all"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(50)
});
