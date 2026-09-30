import { z } from "@/framework/facade.js";

export const MessageSchema = z.object({
  message: z.string()
});

export const RoleSchema = z.object({
  id: z.number(),
  name: z.string(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional()
});

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  mobile: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  planId: z.number().nullable().optional(),
  billingCycle: z.string().nullable().optional(),
  trxId: z.string().nullable().optional(),
  paidAmount: z.number().nullable().optional(),
  advanceBalance: z.number().nullable().optional(),
  planPrice: z.number().nullable().optional(),
  shortage: z.number().nullable().optional(),
  isSubscriptionActive: z.boolean().nullable().optional(),
  adminId: z.number().nullable().optional(),
  expDate: z.string().nullable().optional(),
  plan: z.any().nullable().optional(),
  roleId: z.number().nullable().optional(),
  role: RoleSchema.nullable().optional(),
  emailVerifiedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional()
});

export const RechargeWalletSchema = z.object({
  paidAmount: z.coerce.number().min(1),
  trxId: z.string().min(1)
});

export const RegisterSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.email("Invalid email address"),
    mobile: z.string().optional().nullable(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100),
    password_confirmation: z.string().optional().nullable(),
    planId: z.number().optional().nullable(),
    billingCycle: z.string().optional().nullable(),
    trxId: z.string().optional().nullable(),
    paidAmount: z.number().optional().nullable()
  })
  .superRefine((data, ctx) => {
    if (data.password_confirmation && data.password !== data.password_confirmation) {
      ctx.addIssue({
        code: "custom",
        path: ["password_confirmation"],
        message: "Password confirmation does not match"
      });
    }
  });

export const LoginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional().default(false)
});

export const ForgotPasswordSchema = z.object({
  email: z.email("Invalid email address")
});

export const ResetPasswordSchema = z
  .object({
    email: z.email("Invalid email address"),
    token: z.string().optional(),
    otp: z.string().optional(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100)
      .optional(),
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100)
      .optional(),
    password_confirmation: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if (!data.token && !data.otp) {
      ctx.addIssue({
        code: "custom",
        path: ["otp"],
        message: "Token or OTP is required"
      });
    }
    if (!data.password && !data.newPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Password is required"
      });
    }
    if (data.password_confirmation && (data.password || data.newPassword) !== data.password_confirmation) {
      ctx.addIssue({
        code: "custom",
        path: ["password_confirmation"],
        message: "Password confirmation does not match"
      });
    }
  });

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1)
});

export const VerifyEmailSchema = z.object({
  email: z.email(),
  token: z.string().min(1)
});

export const AuthResponseSchema = z.object({
  message: z.string(),
  data: z.object({
    user: UserSchema,
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.literal("Bearer")
  })
});

export const IdParamsSchema = z.object({
  id: z.coerce.number()
});
