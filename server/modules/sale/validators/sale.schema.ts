import { z } from "zod";
import {
  clientRef,
  dateOnly,
  dateRangeQuery,
  emptyObject,
  money,
  optionalText,
  pageQuery,
  paymentMethod,
  phone,
  positiveMoney,
  quantity,
  requiredText,
  uuid,
} from "../../../shared/validation/common";

export const cartLine = z.object({
  variantId: uuid,
  quantity,
  /** Leave out to sell at the list price. A different price needs `sale.priceoverride`. */
  unitPrice: money.optional(),
  discount: money.default(0),
});

export const cartDiscount = z
  .object({
    type: z.enum(["amount", "percent"]),
    value: z.number().min(0),
  })
  .refine((d) => (d.type === "percent" ? d.value <= 100 : Number.isInteger(d.value)), { message: "Percent must be 0–100; amounts are whole kobo" });

export const createSaleSchema = z.object({
  body: z
    .object({
      branchId: uuid.optional(),
      customerId: uuid.optional(),
      /** Quick-add a walk-in customer at the till (reused if the phone number already exists). */
      customer: z.object({ name: requiredText(160), phone: phone.optional().nullable() }).optional(),
      /** Backdating needs `sale.backdate`. */
      soldAt: z.string().datetime({ offset: true }).optional(),
      items: z.array(cartLine).min(1).max(200),
      discount: cartDiscount.optional(),
      payments: z
        .array(z.object({ method: paymentMethod, amount: positiveMoney, accountId: uuid.optional(), reference: optionalText(120) }))
        .max(5)
        .default([]),
      dueDate: dateOnly.optional(),
      notes: optionalText(1000),
      clientRef,
    })
    .refine((b) => !(b.customerId && b.customer), { message: "Pick an existing customer or add a new one, not both", path: ["customer"] }),
});

export const listSalesSchema = z.object({
  query: z.object({
    ...pageQuery,
    branchId: uuid.optional(),
    soldById: uuid.optional(),
    customerId: uuid.optional(),
    status: z.enum(["completed", "voided"]).optional(),
    paymentStatus: z.enum(["paid", "part_paid", "credit", "unpaid"]).optional(),
    ...dateRangeQuery,
  }),
});

export const saleIdSchema = z.object({ params: z.object({ id: uuid }) });

export const voidSaleSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ reason: requiredText(255, 3) }),
});

export const receiptSchema = z.object({
  params: z.object({ id: uuid }),
  query: z.object({ size: z.enum(["thermal", "a4"]).default("thermal") }),
});

export const publicReceiptSchema = z.object({
  params: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{16,48}$/) }),
  query: z.object({ size: z.enum(["thermal", "a4"]).default("thermal") }),
});

export const createReturnSchema = z.object({
  body: z.object({
    saleId: uuid,
    items: z.array(z.object({ saleItemId: uuid, quantity, restock: z.boolean().default(true) })).min(1).max(200),
    reason: optionalText(500),
    returnDate: dateOnly.optional(),
    /** How any refund is paid back (defaults to cash). */
    refundMethod: paymentMethod.default("cash"),
    accountId: uuid.optional(),
  }),
});

export const listReturnsSchema = z.object({
  query: z.object({ page: pageQuery.page, limit: pageQuery.limit, saleId: uuid.optional(), branchId: uuid.optional(), ...dateRangeQuery }),
});

export const returnIdSchema = z.object({ params: z.object({ id: uuid }) });

export const dailySummarySchema = z.object({
  query: z.object({ date: dateOnly.optional(), branchId: uuid.optional() }),
});

export const commissionsSchema = z.object({
  query: z.object({ ...dateRangeQuery, branchId: uuid.optional(), soldById: uuid.optional() }),
});

export const cashupPreviewSchema = z.object({
  query: z.object({ date: dateOnly.optional(), branchId: uuid.optional(), accountId: uuid.optional() }),
});

export const closeCashupSchema = z.object({
  body: z.object({
    date: dateOnly.optional(),
    branchId: uuid.optional(),
    accountId: uuid.optional(),
    countedAmount: money,
    notes: optionalText(1000),
    /** Post the difference to the cash account so the books match the drawer. */
    postAdjustment: z.boolean().default(false),
  }),
});

export const listCashupsSchema = z.object({
  query: z.object({ page: pageQuery.page, limit: pageQuery.limit, branchId: uuid.optional(), ...dateRangeQuery }),
});

export const noBody = z.object({ body: emptyObject.optional() });

export type CreateSaleInput = z.infer<typeof createSaleSchema>["body"];
export type ListSalesQuery = z.infer<typeof listSalesSchema>["query"];
export type CreateReturnInput = z.infer<typeof createReturnSchema>["body"];
export type ListReturnsQuery = z.infer<typeof listReturnsSchema>["query"];
export type CloseCashupInput = z.infer<typeof closeCashupSchema>["body"];
