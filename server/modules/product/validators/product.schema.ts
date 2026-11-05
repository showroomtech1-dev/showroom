import { z } from "zod";
import {
  emptyObject,
  money,
  optionalText,
  pageQuery,
  queryBool,
  requiredText,
  uuid,
} from "../../../shared/validation/common";

const reorder = z.number().int().min(0).max(1_000_000);
const opening = z.number().int().min(0).max(1_000_000);
const code = (max: number) => z.string().trim().max(max).optional().nullable();

export const variantInput = z.object({
  name: optionalText(120),
  size: optionalText(40),
  color: optionalText(40),
  model: optionalText(60),
  sku: code(60),
  barcode: code(64),
  costPrice: money.optional(),
  sellingPrice: money.optional(),
  reorderLevel: reorder.optional().nullable(),
  openingQuantity: opening.optional(),
  openingStock: opening.optional(),
});

export const createProductSchema = z.object({
  body: z.object({
    name: requiredText(160),
    categoryId: uuid.optional().nullable(),
    brand: optionalText(80),
    description: optionalText(4000),
    unit: z.string().trim().min(1).max(20).default("pcs"),
    costPrice: money,
    sellingPrice: money,
    reorderLevel: reorder.default(0),
    supplierId: uuid.optional().nullable(),
    sku: code(60),
    barcode: code(64),
    /** Opening stock for a product without variants. */
    openingQuantity: opening.optional(),
    openingStock: opening.optional(),
    /** Branch the opening stock goes into (defaults to the user's / main branch). */
    branchId: uuid.optional(),
    variants: z.array(variantInput).max(100).optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      name: requiredText(160),
      categoryId: uuid.nullable(),
      brand: optionalText(80),
      description: optionalText(4000),
      unit: z.string().trim().min(1).max(20),
      costPrice: money,
      sellingPrice: money,
      reorderLevel: reorder,
      supplierId: uuid.nullable(),
      isActive: z.boolean(),
      /** Barcode of the product's only variant (products without variants). */
      barcode: code(64),
      /** Also apply the new cost/selling price to every variant. */
      applyPricesToVariants: z.boolean(),
      /** Optional opening / updated stock quantity for the product's primary variant. */
      openingQuantity: opening,
      openingStock: opening,
      branchId: uuid,
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const addVariantSchema = z.object({
  params: z.object({ id: uuid }),
  body: variantInput.extend({ branchId: uuid.optional() }),
});

export const updateVariantSchema = z.object({
  params: z.object({ id: uuid, variantId: uuid }),
  body: z
    .object({
      name: optionalText(120),
      size: optionalText(40),
      color: optionalText(40),
      model: optionalText(60),
      sku: z.string().trim().min(1).max(60),
      barcode: code(64),
      costPrice: money,
      sellingPrice: money,
      reorderLevel: reorder.nullable(),
      isActive: z.boolean(),
      openingQuantity: opening,
      openingStock: opening,
      branchId: uuid,
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const variantIdSchema = z.object({ params: z.object({ id: uuid, variantId: uuid }) });

export const listProductsSchema = z.object({
  query: z.object({
    ...pageQuery,
    categoryId: uuid.optional(),
    supplierId: uuid.optional(),
    branchId: uuid.optional(),
    isActive: queryBool.optional(),
    stockStatus: z.enum(["low", "out", "attention"]).optional(),
    sort: z.enum(["name", "newest", "price", "stock"]).default("name"),
  }),
});

export const posSearchSchema = z.object({
  query: z.object({
    q: z.string().trim().min(1).max(80),
    branchId: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const barcodeSchema = z.object({
  params: z.object({ code: z.string().trim().min(1).max(64) }),
  query: z.object({ branchId: uuid.optional() }),
});

export const productIdSchema = z.object({ params: z.object({ id: uuid }) });
export const productPhotosSchema = z.object({ params: z.object({ id: uuid }), body: emptyObject.optional() });
export const photoIdSchema = z.object({ params: z.object({ id: uuid, photoId: uuid }) });

export const createCategorySchema = z.object({
  body: z.object({ name: requiredText(100), description: optionalText(500) }),
});
export const updateCategorySchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ name: requiredText(100), description: optionalText(500) }).partial(),
});
export const categoryIdSchema = z.object({ params: z.object({ id: uuid }) });

export type VariantInput = z.infer<typeof variantInput>;
export type CreateProductInput = z.infer<typeof createProductSchema>["body"];
export type UpdateProductInput = z.infer<typeof updateProductSchema>["body"];
export type AddVariantInput = z.infer<typeof addVariantSchema>["body"];
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>["body"];
export type ListProductsQuery = z.infer<typeof listProductsSchema>["query"];
export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>["body"];
