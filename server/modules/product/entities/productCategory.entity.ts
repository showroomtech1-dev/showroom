import { EntitySchema } from "typeorm";
import {
  createdAt,
  deletedAt,
  manyToOne,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface ProductCategory {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const ProductCategoryEntity = new EntitySchema<ProductCategory>({
  name: "ProductCategory",
  tableName: "product_categories",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    name: varchar("name", 100),
    description: textColumn("description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [
    { name: "UQ_product_categories_org_name", columns: ["organizationId", "name"], unique: true, where: "deleted_at IS NULL" },
  ],
});
