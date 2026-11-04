import { z } from "zod";
import { PAY_FREQUENCIES } from "../../../config/constants";
import { dateOnly, emptyObject, money, optionalText, pageQuery, paymentMethod, positiveMoney, uuid } from "../../../shared/validation/common";

const payLine = z.object({ label: z.string().trim().min(1).max(80), amount: money });

export const createRunSchema = z.object({
  body: z
    .object({
      frequency: z.enum(PAY_FREQUENCIES).default("monthly"),
      periodStart: dateOnly,
      periodEnd: dateOnly,
      payDate: dateOnly,
      /** Only employees of this branch (default: all branches). */
      branchId: uuid.optional(),
      notes: optionalText(1000),
    })
    .refine((b) => b.periodEnd >= b.periodStart, { message: "The period must end after it starts", path: ["periodEnd"] }),
});

export const listRunsSchema = z.object({
  query: z.object({
    page: pageQuery.page,
    limit: pageQuery.limit,
    status: z.enum(["draft", "approved", "paid", "cancelled"]).optional(),
    frequency: z.enum(PAY_FREQUENCIES).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
});

export const runIdSchema = z.object({ params: z.object({ id: uuid }), body: emptyObject.optional() });

export const updateItemSchema = z.object({
  params: z.object({ id: uuid, itemId: uuid }),
  body: z
    .object({
      allowanceLines: z.array(payLine).max(20),
      bonus: money,
      deductionLines: z.array(payLine).max(20),
      /** Override how much of each loan/advance to deduct this run (0 to skip). */
      loanDeductions: z.array(z.object({ loanId: uuid, amount: money })).max(20),
      notes: optionalText(1000),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const itemIdSchema = z.object({ params: z.object({ id: uuid, itemId: uuid }) });

export const payRunSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    /** Pay these employees only (default: everyone not yet fully paid). */
    itemIds: z.array(uuid).max(500).optional(),
    method: paymentMethod,
    accountId: uuid.optional(),
    paymentDate: dateOnly.optional(),
    reference: optionalText(120),
  }),
});

export const payItemSchema = z.object({
  params: z.object({ id: uuid, itemId: uuid }),
  body: z.object({
    /** Part-payment; leave out to pay the full balance. */
    amount: positiveMoney.optional(),
    method: paymentMethod,
    accountId: uuid.optional(),
    paymentDate: dateOnly.optional(),
    reference: optionalText(120),
  }),
});

export const listPayslipsSchema = z.object({
  query: z.object({ page: pageQuery.page, limit: pageQuery.limit, runId: uuid.optional(), employeeId: uuid.optional() }),
});

export const payslipIdSchema = z.object({ params: z.object({ id: uuid }) });
export const employeeLedgerSchema = z.object({ params: z.object({ employeeId: uuid }) });

export type CreateRunInput = z.infer<typeof createRunSchema>["body"];
export type ListRunsQuery = z.infer<typeof listRunsSchema>["query"];
export type UpdateItemInput = z.infer<typeof updateItemSchema>["body"];
export type PayRunInput = z.infer<typeof payRunSchema>["body"];
export type PayItemInput = z.infer<typeof payItemSchema>["body"];
