import { z } from "zod";
import { EXPENSE_FREQUENCIES } from "../../../config/constants";
import {
  clientRef,
  dateOnly,
  dateRangeQuery,
  emptyObject,
  exportFormat,
  optionalText,
  pageQuery,
  paymentMethod,
  positiveMoney,
  queryBool,
  requiredText,
  uuid,
} from "../../../shared/validation/common";

export const listCategoriesSchema = z.object({ query: z.object({ includeInactive: queryBool.optional() }) });
export const createCategorySchema = z.object({ body: z.object({ name: requiredText(80) }) });
export const updateCategorySchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ name: requiredText(80), isActive: z.boolean() }).partial().refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});
export const categoryIdSchema = z.object({ params: z.object({ id: uuid }) });

const expenseFields = {
  branchId: uuid.optional(),
  expenseDate: dateOnly.optional(),
  categoryId: uuid,
  amount: positiveMoney,
  method: paymentMethod,
  accountId: uuid.optional(),
  payee: optionalText(160),
  supplierId: uuid.optional().nullable(),
  description: optionalText(2000),
};

export const createExpenseSchema = z.object({ body: z.object({ ...expenseFields, clientRef }) });

export const updateExpenseSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object(expenseFields)
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

const filterQuery = {
  branchId: uuid.optional(),
  categoryId: uuid.optional(),
  supplierId: uuid.optional(),
  method: paymentMethod.optional(),
  payee: z.string().trim().max(160).optional(),
  ...dateRangeQuery,
};

export const listExpensesSchema = z.object({ query: z.object({ ...pageQuery, ...filterQuery }) });
export const expenseIdSchema = z.object({ params: z.object({ id: uuid }) });
export const expenseReceiptSchema = z.object({ params: z.object({ id: uuid }), body: emptyObject.optional() });

export const expenseReportSchema = z.object({
  query: z.object({
    ...filterQuery,
    groupBy: z.enum(["category", "payee", "day", "week", "month", "method"]).default("category"),
    format: exportFormat,
  }),
});

const recurringFields = {
  branchId: uuid.optional(),
  categoryId: uuid,
  name: requiredText(120),
  amount: positiveMoney,
  method: paymentMethod.default("transfer"),
  accountId: uuid.optional().nullable(),
  payee: optionalText(160),
  supplierId: uuid.optional().nullable(),
  frequency: z.enum(EXPENSE_FREQUENCIES),
  startDate: dateOnly,
  endDate: dateOnly.optional().nullable(),
  notes: optionalText(1000),
};

export const createRecurringSchema = z.object({
  body: z.object(recurringFields).refine((b) => !b.endDate || b.endDate >= b.startDate, { message: "End date must be after the start date", path: ["endDate"] }),
});

export const updateRecurringSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({ ...recurringFields, nextDueDate: dateOnly, isActive: z.boolean() })
    .omit({ startDate: true })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const listRecurringSchema = z.object({ query: z.object({ includeInactive: queryBool.optional(), branchId: uuid.optional() }) });
export const recurringIdSchema = z.object({ params: z.object({ id: uuid }) });

export const recordRecurringSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    expenseDate: dateOnly.optional(),
    /** Override this time only (e.g. a higher electricity bill). */
    amount: positiveMoney.optional(),
    method: paymentMethod.optional(),
    accountId: uuid.optional(),
    description: optionalText(2000),
    clientRef,
  }),
});

export const skipRecurringSchema = z.object({ params: z.object({ id: uuid }), body: emptyObject.optional() });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>["body"];
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>["body"];
export type ListExpensesQuery = z.infer<typeof listExpensesSchema>["query"];
export type ExpenseReportQuery = z.infer<typeof expenseReportSchema>["query"];
export type CreateRecurringInput = z.infer<typeof createRecurringSchema>["body"];
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>["body"];
export type RecordRecurringInput = z.infer<typeof recordRecurringSchema>["body"];
