import { z } from "zod";
import {
  dateOnly,
  dateRangeQuery,
  money,
  optionalText,
  pageQuery,
  paymentMethod,
  positiveMoney,
  quantity,
  uuid,
} from "../../../shared/validation/common";

const lineSchema = z
  .object({
    /** A stocked product variant. Leave out for a service line on a vendor bill. */
    variantId: uuid.optional(),
    description: optionalText(200),
    quantity,
    unitCost: money,
  })
  .refine((l) => Boolean(l.variantId) || Boolean(l.description), { message: "Pick a product or describe the service", path: ["description"] });

export const createSupplySchema = z.object({
  body: z
    .object({
      supplierId: uuid,
      branchId: uuid.optional(),
      supplyDate: dateOnly.optional(),
      dueDate: dateOnly.optional().nullable(),
      invoiceNumber: optionalText(60),
      discount: money.default(0),
      notes: optionalText(2000),
      items: z.array(lineSchema).min(1).max(300),
      /** Pay now (in full or in part). Leave out for a purchase on credit. */
      payment: z
        .object({
          amount: positiveMoney,
          method: paymentMethod,
          accountId: uuid.optional(),
          reference: optionalText(120),
        })
        .optional(),
    })
    .refine((b) => !b.dueDate || !b.supplyDate || b.dueDate >= b.supplyDate, { message: "Due date cannot be before the supply date", path: ["dueDate"] }),
});

export const updateSupplySchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      invoiceNumber: optionalText(60),
      supplyDate: dateOnly,
      dueDate: dateOnly.nullable(),
      notes: optionalText(2000),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const listSuppliesSchema = z.object({
  query: z.object({
    ...pageQuery,
    supplierId: uuid.optional(),
    branchId: uuid.optional(),
    status: z.enum(["paid", "part_paid", "credit", "unpaid", "overdue"]).optional(),
    ...dateRangeQuery,
  }),
});

export const supplyIdSchema = z.object({ params: z.object({ id: uuid }) });

export type CreateSupplyInput = z.infer<typeof createSupplySchema>["body"];
export type UpdateSupplyInput = z.infer<typeof updateSupplySchema>["body"];
export type ListSuppliesQuery = z.infer<typeof listSuppliesSchema>["query"];
