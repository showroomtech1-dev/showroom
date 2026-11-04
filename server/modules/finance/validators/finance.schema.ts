import { z } from "zod";
import { ACCOUNT_TYPES } from "../../../config/constants";
import {
  dateOnly,
  dateRangeQuery,
  money,
  optionalText,
  pageQuery,
  positiveMoney,
  queryBool,
  requiredText,
  uuid,
} from "../../../shared/validation/common";

export const listAccountsSchema = z.object({
  query: z.object({ branchId: uuid.optional(), includeInactive: queryBool.optional() }),
});

export const createAccountSchema = z.object({
  body: z.object({
    name: requiredText(120),
    type: z.enum(ACCOUNT_TYPES),
    branchId: uuid.optional().nullable(),
    bankName: optionalText(120),
    accountNumber: optionalText(30),
    openingBalance: money.default(0),
    isDefault: z.boolean().default(false),
    notes: optionalText(1000),
  }),
});

export const updateAccountSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      name: requiredText(120),
      branchId: uuid.nullable(),
      bankName: optionalText(120),
      accountNumber: optionalText(30),
      isDefault: z.boolean(),
      isActive: z.boolean(),
      notes: optionalText(1000),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const accountIdSchema = z.object({ params: z.object({ id: uuid }) });

export const accountStatementSchema = z.object({
  params: z.object({ id: uuid }),
  query: z.object({ ...dateRangeQuery }),
});

export const listTransfersSchema = z.object({
  query: z.object({ page: pageQuery.page, limit: pageQuery.limit, accountId: uuid.optional(), ...dateRangeQuery }),
});

export const createTransferSchema = z.object({
  body: z
    .object({
      fromAccountId: uuid,
      toAccountId: uuid,
      amount: positiveMoney,
      transferDate: dateOnly.optional(),
      reference: optionalText(120),
      notes: optionalText(1000),
    })
    .refine((b) => b.fromAccountId !== b.toAccountId, { message: "Choose two different accounts", path: ["toAccountId"] }),
});

export const transferIdSchema = z.object({ params: z.object({ id: uuid }) });

export type CreateAccountInput = z.infer<typeof createAccountSchema>["body"];
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>["body"];
export type CreateTransferInput = z.infer<typeof createTransferSchema>["body"];
export type ListTransfersQuery = z.infer<typeof listTransfersSchema>["query"];
