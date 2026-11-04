import { z } from "zod";
import {
  clientRef,
  dateOnly,
  dateRangeQuery,
  email,
  exportFormat,
  money,
  optionalText,
  pageQuery,
  paymentMethod,
  phone,
  positiveMoney,
  queryBool,
  requiredText,
  uuid,
} from "../../../shared/validation/common";

const customerFields = {
  name: requiredText(160),
  phone: phone.optional().nullable(),
  email: email.optional().nullable(),
  address: optionalText(500),
  notes: optionalText(2000),
  creditLimit: money.optional().nullable(),
};

export const createCustomerSchema = z.object({ body: z.object(customerFields) });

export const updateCustomerSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({ ...customerFields, isActive: z.boolean() })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const listCustomersSchema = z.object({
  query: z.object({
    ...pageQuery,
    isActive: queryBool.optional(),
    withDebt: queryBool.optional(),
    sort: z.enum(["name", "balance", "recent"]).default("name"),
  }),
});

export const customerIdSchema = z.object({ params: z.object({ id: uuid }) });

export const customerHistorySchema = z.object({
  params: z.object({ id: uuid }),
  query: z.object({ page: pageQuery.page, limit: pageQuery.limit }),
});

export const customerStatementSchema = z.object({
  params: z.object({ id: uuid }),
  query: z.object({ ...dateRangeQuery, format: exportFormat }),
});

export const debtorsSchema = z.object({ query: z.object({ format: exportFormat }) });

export const createCustomerPaymentSchema = z.object({
  body: z.object({
    customerId: uuid,
    /** Apply to this sale first; the rest goes to the oldest unpaid sales. */
    saleId: uuid.optional(),
    branchId: uuid.optional(),
    amount: positiveMoney,
    method: paymentMethod,
    accountId: uuid.optional(),
    paymentDate: dateOnly.optional(),
    reference: optionalText(120),
    notes: optionalText(1000),
    clientRef,
  }),
});

export const listCustomerPaymentsSchema = z.object({
  query: z.object({
    ...pageQuery,
    customerId: uuid.optional(),
    branchId: uuid.optional(),
    method: paymentMethod.optional(),
    ...dateRangeQuery,
  }),
});

export const customerPaymentIdSchema = z.object({ params: z.object({ id: uuid }) });

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>["body"];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>["body"];
export type ListCustomersQuery = z.infer<typeof listCustomersSchema>["query"];
export type CustomerStatementQuery = z.infer<typeof customerStatementSchema>["query"];
export type CreateCustomerPaymentInput = z.infer<typeof createCustomerPaymentSchema>["body"];
export type ListCustomerPaymentsQuery = z.infer<typeof listCustomerPaymentsSchema>["query"];
