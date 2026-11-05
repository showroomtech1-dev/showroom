import { z } from "zod"

export const loginFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

export const registerFormSchema = z.object({
  businessName: z.string().trim().min(2, "Showroom / business name is required").max(160),
  ownerName: z.string().trim().min(2, "Your full name is required").max(160),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/(?=.*[A-Za-z])(?=.*\d)/, "Include at least one letter and one number"),
})

export const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/(?=.*[A-Za-z])(?=.*\d)/, "Include at least one letter and one number"),
})

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(160),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email("Invalid email").or(z.literal("")).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  creditLimitNaira: z.string().optional(),
})

export const supplierFormSchema = z.object({
  type: z.enum(["supplier", "vendor"]),
  name: z.string().trim().min(1, "Name is required").max(160),
  contactPerson: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email("Invalid email").or(z.literal("")).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  bankName: z.string().trim().max(120).optional().nullable(),
  bankAccountNumber: z.string().trim().optional().nullable(),
  bankAccountName: z.string().trim().max(160).optional().nullable(),
  paymentTermsDays: z.number().int().min(0).max(365).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(160),
  categoryId: z.string().optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  unit: z.string().trim().min(1, "Unit is required").max(20),
  costPrice: z.number().int().min(0, "Cost price cannot be negative"),
  sellingPrice: z.number().int().min(0, "Selling price cannot be negative"),
  reorderLevel: z.number().int().min(0).max(1_000_000),
  supplierId: z.string().optional().nullable(),
  sku: z.string().trim().max(60).optional().nullable(),
  barcode: z.string().trim().max(64).optional().nullable(),
  openingQuantity: z.number().int().min(0).optional(),
})
