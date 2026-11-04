import { z } from "zod";
import { LOAN_TYPES } from "../../../config/constants";
import { dateOnly, optionalText, pageQuery, paymentMethod, positiveMoney, uuid } from "../../../shared/validation/common";

export const createLoanSchema = z.object({
  body: z
    .object({
      employeeId: uuid,
      type: z.enum(LOAN_TYPES),
      principal: positiveMoney,
      /** Deducted from each payroll run. Defaults to the full amount for an advance. */
      installmentAmount: positiveMoney.optional(),
      issueDate: dateOnly.optional(),
      method: paymentMethod,
      accountId: uuid.optional(),
      reference: optionalText(120),
      notes: optionalText(1000),
    })
    .refine((b) => !b.installmentAmount || b.installmentAmount <= b.principal, { message: "The installment can't be more than the amount", path: ["installmentAmount"] }),
});

export const updateLoanSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({ installmentAmount: positiveMoney, notes: optionalText(1000), status: z.enum(["active", "written_off"]) })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const repayLoanSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ amount: positiveMoney, method: paymentMethod, accountId: uuid.optional(), repaymentDate: dateOnly.optional() }),
});

export const listLoansSchema = z.object({
  query: z.object({
    page: pageQuery.page,
    limit: pageQuery.limit,
    employeeId: uuid.optional(),
    status: z.enum(["active", "settled", "written_off"]).optional(),
    type: z.enum(LOAN_TYPES).optional(),
  }),
});

export const loanIdSchema = z.object({ params: z.object({ id: uuid }) });

export type CreateLoanInput = z.infer<typeof createLoanSchema>["body"];
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>["body"];
export type RepayLoanInput = z.infer<typeof repayLoanSchema>["body"];
export type ListLoansQuery = z.infer<typeof listLoansSchema>["query"];
