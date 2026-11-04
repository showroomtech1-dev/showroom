import { z } from "zod";
import { SUPPLIER_TYPES } from "../../../config/constants";
import {
  dateRangeQuery,
  email,
  exportFormat,
  optionalText,
  pageQuery,
  phone,
  queryBool,
  requiredText,
  uuid,
} from "../../../shared/validation/common";

const supplierFields = {
  type: z.enum(SUPPLIER_TYPES).default("supplier"),
  name: requiredText(160),
  contactPerson: optionalText(120),
  phone: phone.optional().nullable(),
  email: email.optional().nullable(),
  address: optionalText(500),
  category: optionalText(80),
  bankName: optionalText(120),
  bankAccountNumber: z.string().trim().regex(/^[0-9]{6,20}$/, "Enter digits only").optional().nullable(),
  bankAccountName: optionalText(160),
  paymentTermsDays: z.number().int().min(0).max(365).optional().nullable(),
  notes: optionalText(2000),
};

export const createSupplierSchema = z.object({ body: z.object(supplierFields) });

export const updateSupplierSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({ ...supplierFields, type: z.enum(SUPPLIER_TYPES), isActive: z.boolean() })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const listSuppliersSchema = z.object({
  query: z.object({
    ...pageQuery,
    type: z.enum(SUPPLIER_TYPES).optional(),
    category: z.string().trim().max(80).optional(),
    isActive: queryBool.optional(),
    withBalance: queryBool.optional(),
    sort: z.enum(["name", "balance", "recent"]).default("name"),
  }),
});

export const supplierIdSchema = z.object({ params: z.object({ id: uuid }) });

export const supplierStatementSchema = z.object({
  params: z.object({ id: uuid }),
  query: z.object({ ...dateRangeQuery, format: exportFormat }),
});

export const payablesSchema = z.object({
  query: z.object({ type: z.enum(SUPPLIER_TYPES).optional() }),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>["body"];
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>["body"];
export type ListSuppliersQuery = z.infer<typeof listSuppliersSchema>["query"];
export type SupplierStatementQuery = z.infer<typeof supplierStatementSchema>["query"];
