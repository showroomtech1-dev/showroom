import { z } from "zod";
import { ADJUSTMENT_REASONS, STOCK_MOVEMENT_TYPES } from "../../../config/constants";
import { dateRangeQuery, emptyObject, optionalText, pageQuery, quantity, uuid } from "../../../shared/validation/common";

export const listLevelsSchema = z.object({
  query: z.object({
    ...pageQuery,
    branchId: uuid.optional(),
    categoryId: uuid.optional(),
    supplierId: uuid.optional(),
    status: z.enum(["low", "out", "in_stock", "attention"]).optional(),
  }),
});

export const branchQuerySchema = z.object({ query: z.object({ branchId: uuid.optional() }) });

export const listMovementsSchema = z.object({
  query: z.object({
    page: pageQuery.page,
    limit: pageQuery.limit,
    branchId: uuid.optional(),
    variantId: uuid.optional(),
    productId: uuid.optional(),
    type: z.enum(STOCK_MOVEMENT_TYPES).optional(),
    ...dateRangeQuery,
  }),
});

export const adjustStockSchema = z.object({
  body: z
    .object({
      variantId: uuid,
      branchId: uuid.optional(),
      /** "change": add/remove `quantity` (negative removes). "set": make the level exactly `quantity`. */
      mode: z.enum(["change", "set"]).default("change"),
      quantity: z.number().int().min(-1_000_000).max(1_000_000),
      reason: z.enum(ADJUSTMENT_REASONS),
      note: optionalText(255),
    })
    .refine((b) => b.mode === "set" ? b.quantity >= 0 : b.quantity !== 0, { message: "Enter a non-zero change (or a level of 0 or more)", path: ["quantity"] })
    .refine((b) => b.reason !== "other" || Boolean(b.note), { message: "Describe the reason", path: ["note"] }),
});

export const transferStockSchema = z.object({
  body: z.object({
    fromBranchId: uuid.optional(),
    toBranchId: uuid,
    note: optionalText(255),
    items: z.array(z.object({ variantId: uuid, quantity })).min(1).max(200),
  }),
});

export const startStockTakeSchema = z.object({
  body: z.object({
    branchId: uuid.optional(),
    categoryId: uuid.optional(),
    notes: optionalText(1000),
  }),
});

export const listStockTakesSchema = z.object({
  query: z.object({
    page: pageQuery.page,
    limit: pageQuery.limit,
    branchId: uuid.optional(),
    status: z.enum(["in_progress", "completed", "cancelled"]).optional(),
  }),
});

export const stockTakeIdSchema = z.object({ params: z.object({ id: uuid }), body: emptyObject.optional() });

export const stockTakeItemsSchema = z.object({
  params: z.object({ id: uuid }),
  query: z.object({
    page: pageQuery.page,
    limit: z.coerce.number().int().min(1).max(500).default(100),
    search: pageQuery.search,
    uncountedOnly: z.enum(["true", "false"]).optional(),
  }),
});

export const recordCountsSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    counts: z.array(z.object({ variantId: uuid, countedQuantity: z.number().int().min(0).max(1_000_000) })).min(1).max(500),
  }),
});

export type ListLevelsQuery = z.infer<typeof listLevelsSchema>["query"];
export type ListMovementsQuery = z.infer<typeof listMovementsSchema>["query"];
export type AdjustStockInput = z.infer<typeof adjustStockSchema>["body"];
export type TransferStockInput = z.infer<typeof transferStockSchema>["body"];
export type StartStockTakeInput = z.infer<typeof startStockTakeSchema>["body"];
export type ListStockTakesQuery = z.infer<typeof listStockTakesSchema>["query"];
export type StockTakeItemsQuery = z.infer<typeof stockTakeItemsSchema>["query"];
export type RecordCountsInput = z.infer<typeof recordCountsSchema>["body"];
