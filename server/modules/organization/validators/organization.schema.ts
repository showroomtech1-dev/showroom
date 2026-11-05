import { z } from "zod";
import {
  bps,
  email,
  money,
  optionalText,
  phone,
  queryBool,
  requiredText,
  time24,
  uuid,
} from "../../../shared/validation/common";

const isTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const updateBusinessSchema = z.object({
  body: z
    .object({
      name: requiredText(160),
      legalName: optionalText(200),
      phone: phone.optional().nullable(),
      email: email.optional().nullable(),
      address: optionalText(500),
      website: optionalText(200),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const updateSettingsSchema = z.object({
  body: z
    .object({
      currencyCode: z.string().trim().toUpperCase().length(3),
      currencySymbol: z.string().trim().min(1).max(8),
      timezone: z.string().trim().refine(isTimeZone, "Unknown timezone"),
      receiptHeader: optionalText(1000),
      receiptFooter: optionalText(1000),
      taxEnabled: z.boolean(),
      taxName: requiredText(30),
      taxRateBps: bps,
      taxInclusive: z.boolean(),
      taxNumber: optionalText(60),
      commissionEnabled: z.boolean(),
      commissionRateBps: bps,
      allowNegativeStock: z.boolean(),
      reminderDaysBeforeDue: z.number().int().min(0).max(60),
      defaultCreditDays: z.number().int().min(0).max(365),
      workStartTime: time24,
      lateGraceMinutes: z.number().int().min(0).max(240),
      latenessDeduction: money,
      absenceDeduction: money,
      emailDigestEnabled: z.boolean(),
      emailDigestHour: z.number().int().min(0).max(23),
      emailAlertsEnabled: z.boolean(),
      emailReceiptsEnabled: z.boolean(),
      emailDebtRemindersAuto: z.boolean(),
      emailPayslipsEnabled: z.boolean(),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const listBranchesSchema = z.object({
  query: z.object({ includeInactive: queryBool.optional() }),
});

export const createBranchSchema = z.object({
  body: z.object({
    name: requiredText(120),
    code: z.string().trim().toUpperCase().max(20).optional(),
    address: optionalText(500),
    phone: phone.optional().nullable(),
    isMain: z.boolean().optional(),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      name: requiredText(120),
      address: optionalText(500),
      phone: phone.optional().nullable(),
      isMain: z.boolean(),
      isActive: z.boolean(),
    })
    .partial(),
});

export const branchIdSchema = z.object({ params: z.object({ id: uuid }) });

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>["body"];
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>["body"];
export type CreateBranchInput = z.infer<typeof createBranchSchema>["body"];
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>["body"];
