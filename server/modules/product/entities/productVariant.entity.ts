import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  deletedAt,
  intColumn,
  manyToOne,
  moneyColumn,
  primaryId,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface ProductVariant {
  id: string;
  organizationId: string;
  productId: string;
  name: string;
  size: string | null;
  color: string | null;
  model: string | null;
  sku: string;
  barcode: string | null;
  /** Moving weighted-average cost, updated when goods are received. */
  costPrice: number;
  sellingPrice: number;
  /** Null = use the product's reorder level. */
  reorderLevel: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  product?: { id: string };
}

export const ProductVariantEntity = new EntitySchema<ProductVariant>({
  name: "ProductVariant",
  tableName: "product_variants",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    productId: uuidColumn("product_id"),
    name: varchar("name", 120, false, "Default"),
    size: varchar("size", 40, true),
    color: varchar("color", 40, true),
    model: varchar("model", 60, true),
    sku: varchar("sku", 60),
    barcode: varchar("barcode", 64, true),
    costPrice: moneyColumn("cost_price"),
    sellingPrice: moneyColumn("selling_price"),
    reorderLevel: intColumn("reorder_level", null),
    isActive: boolColumn("is_active", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { product: manyToOne("Product", "product_id", "CASCADE") },
  indices: [
    { name: "IDX_product_variants_product", columns: ["productId"] },
    { name: "UQ_product_variants_org_sku", columns: ["organizationId", "sku"], unique: true, where: "deleted_at IS NULL" },
    {
      name: "UQ_product_variants_org_barcode",
      columns: ["organizationId", "barcode"],
      unique: true,
      where: "barcode IS NOT NULL AND deleted_at IS NULL",
    },
  ],
});
