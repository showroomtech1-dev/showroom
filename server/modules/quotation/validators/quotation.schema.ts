import { z } from "zod";
import { QUOTATION_STATUSES } from "../../../config/constants";
import {
  clientRef,
  dateOnly,
  dateRangeQuery,
  money,
  optionalText,
  pageQuery,
  paymentMethod,
  phone,
  positiveMoney,
  quantity,
  uuid,
} from "../../../shared/validation/common";
import { cartDiscount } from "../../sale/validators/sale.schema";

const quoteLine = z.object({ variantId: uuid, quantity, unitPrice: money.optional(), discount: money.default(0) });

const quoteFields = {
  branchId: uuid.optional(),
  customerId: uuid.optional().nullable(),
  customerName: optionalText(160),
  customerPhone: phone.optional().nullable(),
  quoteDate: dateOnly.optional(),
  validUntil: dateOnly.optional().nullable(),
  items: z.array(quoteLine).min(1).max(200),
  discount: cartDiscount.optional(),
  notes: optionalText(2000),
  terms: optionalText(2000),
};

export const createQuotationSchema = z.object({ body: z.object(quoteFields) });

export const updateQuotationSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object(quoteFields)
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const quotationStatusSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ status: z.enum(["sent", "accepted", "cancelled"]) }),
});

export const convertQuotationSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    payments: z
      .array(z.object({ method: paymentMethod, amount: positiveMoney, accountId: uuid.optional(), reference: optionalText(120) }))
      .max(5)
      .default([]),
    dueDate: dateOnly.optional(),
    notes: optionalText(1000),
    clientRef,
  }),
});

export const listQuotationsSchema = z.object({
  query: z.object({
    ...pageQuery,
    status: z.enum(QUOTATION_STATUSES).optional(),
    customerId: uuid.optional(),
    branchId: uuid.optional(),
    ...dateRangeQuery,
  }),
});

export const quotationIdSchema = z.object({ params: z.object({ id: uuid }) });

export const quotationPdfSchema = z.object({
  params: z.object({ id: uuid }),
  query: z.object({ title: z.enum(["quotation", "proforma"]).default("quotation") }),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>["body"];
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>["body"];
export type ConvertQuotationInput = z.infer<typeof convertQuotationSchema>["body"];
export type ListQuotationsQuery = z.infer<typeof listQuotationsSchema>["query"];
