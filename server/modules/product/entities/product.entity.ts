// A product groups one or more sellable variants (size / colour / model). Products without real
// variants still get exactly one "Default" variant, so stock and sales always point at a variant.
import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  deletedAt,
  intColumn,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  categoryId: string | null;
  brand: string | null;
  description: string | null;
  unit: string;
  /** Default prices copied to new variants. */
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
  supplierId: string | null;
  hasVariants: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  category?: { id: string };
  supplier?: { id: string };
}

export const ProductEntity = new EntitySchema<Product>({
  name: "Product",
  tableName: "products",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    name: varchar("name", 160),
    categoryId: uuidColumn("category_id", true),
    brand: varchar("brand", 80, true),
    description: textColumn("description"),
    unit: varchar("unit", 20, false, "pcs"),
    costPrice: moneyColumn("cost_price"),
    sellingPrice: moneyColumn("selling_price"),
    reorderLevel: intColumn("reorder_level", 0),
    supplierId: uuidColumn("supplier_id", true),
    hasVariants: boolColumn("has_variants", false),
    isActive: boolColumn("is_active", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    category: manyToOne("ProductCategory", "category_id", "SET NULL"),
    supplier: manyToOne("Supplier", "supplier_id", "SET NULL"),
  },
  indices: [
    { name: "IDX_products_org_name", columns: ["organizationId", "name"] },
    { name: "IDX_products_org_category", columns: ["organizationId", "categoryId"] },
    { name: "IDX_products_org_supplier", columns: ["organizationId", "supplierId"] },
  ],
});
