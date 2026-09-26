import { z } from "zod";

export const billItemSchema = z.object({
  serviceItemId: z.number().int().positive().optional().nullable(),
  itemName: z.string().min(1, "Service item name is required"),
  unit: z.string().default("Month"),
  qty: z.number().min(0, "Quantity must be greater than or equal to 0").default(1),
  rateUsed: z.number().min(0, "Rate must be greater than or equal to 0").default(0),
  minimumChargeUsed: z.number().min(0).default(0),
  calculatedAmount: z.number().min(0).default(0),
  finalAmount: z.number().min(0, "Amount must be greater than or equal to 0"),
  notes: z.string().optional().nullable()
});

export const createBillSchema = z.object({
  clientId: z.number().int().positive("Client is required"),
  referenceId: z.number().int().positive().optional().nullable(),
  taxPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Tax period must be YYYY-MM format"),
  billDate: z.string().min(1, "Bill date is required"),
  dueDate: z.string().optional().nullable(),
  discountAmount: z.number().min(0, "Discount cannot be negative").default(0),
  notes: z.string().optional().nullable(),
  status: z.enum(["draft", "finalized", "unpaid", "paid", "partial"]).default("finalized"),
  items: z.array(billItemSchema).min(1, "At least one service line item is required")
});

export const batchGenerateBillsSchema = z.object({
  taxPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Tax period must be YYYY-MM format"),
  billDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  clientIds: z.array(z.number().int().positive()).optional()
});

export const updateBillSchema = z.object({
  billDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  discountAmount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  status: z.enum(["draft", "finalized", "unpaid", "paid", "partial", "cancelled"]).optional(),
  items: z.array(billItemSchema).optional()
});

export const createCollectionSchema = z.object({
  clientId: z.number().int().positive("Client is required"),
  billId: z.number().int().positive().optional().nullable(),
  collectionDate: z.string().min(1, "Collection date is required"),
  amount: z.number().positive("Collection amount must be greater than 0"),
  paymentMethod: z.enum(["cash", "bank", "cheque", "bkash", "nagad", "rocket", "other"]).default("cash"),
  referenceNo: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const listBillsQuerySchema = z.object({
  month: z.string().optional(),
  taxPeriod: z.string().optional(),
  clientId: z.string().optional(),
  status: z.string().optional(),
  customerTypeId: z.string().optional(),
  referenceId: z.string().optional(),
  managerId: z.string().optional(),
  search: z.string().optional()
});

export const listCollectionsQuerySchema = z.object({
  month: z.string().optional(),
  clientId: z.string().optional(),
  paymentMethod: z.string().optional(),
  search: z.string().optional()
});

export const clientBillingSummaryQuerySchema = z.object({
  clientId: z.string().optional(),
  month: z.string().optional()
});
