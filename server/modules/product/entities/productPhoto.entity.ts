import { EntitySchema } from "typeorm";
import { createdAt, intColumn, manyToOne, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface ProductPhoto {
  id: string;
  productId: string;
  url: string;
  publicId: string;
  sortOrder: number;
  createdAt: Date;
  product?: { id: string };
}

export const ProductPhotoEntity = new EntitySchema<ProductPhoto>({
  name: "ProductPhoto",
  tableName: "product_photos",
  columns: {
    id: primaryId(),
    productId: uuidColumn("product_id"),
    url: varchar("url", 500),
    publicId: varchar("public_id", 255),
    sortOrder: intColumn("sort_order", 0),
    createdAt: createdAt(),
  },
  relations: { product: manyToOne("Product", "product_id", "CASCADE") },
  indices: [{ name: "IDX_product_photos_product", columns: ["productId"] }],
});
