import { z } from "@/framework/facade.js";

export const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  mobile: z.string().min(1, "Mobile is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "user"]).default("user"),
  status: z.enum(["active", "inactive"]).default("active"),
  permissions: z.array(z.string()).default([])
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Valid email is required").optional(),
  mobile: z.string().optional(),
  role: z.enum(["admin", "user"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  permissions: z.array(z.string()).optional()
});

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters")
});

export const UpdateStatusSchema = z.object({
  status: z.enum(["active", "inactive"]).optional()
});

export const IdParamSchema = z.object({
  id: z.string()
});
