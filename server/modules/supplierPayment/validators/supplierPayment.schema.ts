import { z } from "zod";
import {
  clientRef,
  dateOnly,
  dateRangeQuery,
  emptyObject,
  optionalText,
  pageQuery,
  paymentMethod,
  positiveMoney,
  queryBool,
  uuid,
} from "../../../shared/validation/common";

export const paymentFields = {
  amount: positiveMoney,
  method: paymentMethod,
  accountId: uuid.optional(),
  paymentDate: dateOnly.optional(),
  reference: optionalText(120),
  notes: optionalText(1000),
};

export const createSupplierPaymentSchema = z.object({
  body: z.object({
    supplierId: uuid,
    /** Apply to this supply first; any remainder goes to the oldest unpaid supplies. */
    supplyId: uuid.optional(),
    branchId: uuid.optional(),
    clientRef,
    ...paymentFields,
  }),
});

export const listSupplierPaymentsSchema = z.object({
  query: z.object({
    ...pageQuery,
    supplierId: uuid.optional(),
    method: paymentMethod.optional(),
    overpaymentsOnly: queryBool.optional(),
    ...dateRangeQuery,
  }),
});

export const supplierPaymentIdSchema = z.object({ params: z.object({ id: uuid }) });
export const supplierPaymentProofSchema = z.object({ params: z.object({ id: uuid }), body: emptyObject.optional() });

export const updateSupplierPaymentSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({ reference: optionalText(120), notes: optionalText(1000) })
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>["body"];
export type ListSupplierPaymentsQuery = z.infer<typeof listSupplierPaymentsSchema>["query"];
export type UpdateSupplierPaymentInput = z.infer<typeof updateSupplierPaymentSchema>["body"];
