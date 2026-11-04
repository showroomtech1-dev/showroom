// Reusable Zod building blocks. All money is an integer in the minor unit (kobo).
import { z } from "zod";
import { EXPORT_FORMATS, MAX_MONEY, PAYMENT_METHODS } from "../../config/constants";

export const uuid = z.string().uuid("Must be a valid id");

/** Integer minor units (kobo), 0 or more. */
export const money = z
  .number({ invalid_type_error: "Must be a number (in kobo)" })
  .int("Amounts are whole numbers in kobo")
  .min(0, "Cannot be negative")
  .max(MAX_MONEY, "Amount is too large");

export const positiveMoney = money.refine((v) => v > 0, "Must be greater than zero");

/** Coerced money for multipart / query input. */
export const moneyCoerced = z.coerce.number().int().min(0).max(MAX_MONEY);

export const quantity = z.number().int("Quantities are whole numbers").min(1, "Must be at least 1").max(1_000_000);

/** Basis points: 750 = 7.5 %. */
export const bps = z.number().int().min(0).max(10_000);

export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");

export const time24 = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the format HH:MM");

export const paymentMethod = z.enum(PAYMENT_METHODS);

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number");

export const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
export const requiredText = (max: number, min = 1) => z.string().trim().min(min, "Required").max(max);

export const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(160);

/** Query-string boolean ("true" / "false" / "1" / "0"). */
export const queryBool = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
};

export const dateRangeQuery = {
  from: dateOnly.optional(),
  to: dateOnly.optional(),
};

export const exportFormat = z.enum(EXPORT_FORMATS).default("json");

export const idParams = z.object({ id: uuid });

/** Idempotency key sent by clients (offline queue) so retries never create duplicates. */
export const clientRef = z.string().trim().min(8).max(64).optional();

export const paymentInput = z.object({
  amount: positiveMoney,
  method: paymentMethod,
  accountId: uuid.optional(),
  reference: optionalText(120),
});

export const emptyObject = z.object({}).passthrough();
