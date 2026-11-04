import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { ProductDetailDTO, ProductListItemDTO, ProductPhotoDTO } from "../dto/product.dto";
import { ProductEntity, type Product } from "../entities/product.entity";
import { ProductPhotoEntity } from "../entities/productPhoto.entity";
import type { ListProductsQuery } from "../validators/product.schema";

type ProductRow = Omit<ProductDetailDTO, "variants" | "photos">;

const SORT: Record<ListProductsQuery["sort"], string> = {
  name: `x.name ASC`,
  newest: `x."createdAt" DESC`,
  price: `x."minPrice" ASC`,
  stock: `x.quantity ASC`,
};

export class ProductRepository {
  static Instance = new ProductRepository();
  private constructor() {}

  async list(organizationId: string, f: Omit<ListProductsQuery, "branchId"> & { branchId: string | null }): Promise<PagedRows<ProductListItemDTO>> {
    const p = new SqlParams();
    const where = [`p.organization_id = ${p.add(organizationId)}`, "p.deleted_at IS NULL"];
    const stockJoin = f.branchId ? `AND sl.branch_id = ${p.add(f.branchId)}` : "";
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(p.name ILIKE ${s} OR p.brand ILIKE ${s} OR EXISTS (
        SELECT 1 FROM product_variants sv WHERE sv.product_id = p.id AND sv.deleted_at IS NULL
          AND (sv.sku ILIKE ${s} OR sv.barcode ILIKE ${s} OR sv.name ILIKE ${s})))`);
    }
    if (f.categoryId) where.push(`p.category_id = ${p.add(f.categoryId)}`);
    if (f.supplierId) where.push(`p.supplier_id = ${p.add(f.supplierId)}`);
    if (f.isActive !== undefined) where.push(`p.is_active = ${p.add(f.isActive)}`);
    const stockWhere =
      f.stockStatus === "out" ? "WHERE x.quantity <= 0"
      : f.stockStatus === "low" ? `WHERE x.quantity > 0 AND x.quantity <= x."reorderLevel"`
      : f.stockStatus === "attention" ? `WHERE x.quantity <= x."reorderLevel"`
      : "";
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (
         SELECT p.id, p.name, p.brand, p.unit, p.category_id AS "categoryId", c.name AS "categoryName",
                p.supplier_id AS "supplierId", s.name AS "supplierName", p.has_variants AS "hasVariants",
                p.is_active AS "isActive", p.reorder_level AS "reorderLevel", p.cost_price AS "costPrice", p.created_at AS "createdAt",
                (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.deleted_at IS NULL)::int AS "variantCount",
                (SELECT MIN(v.sku) FROM product_variants v WHERE v.product_id = p.id AND v.deleted_at IS NULL) AS sku,
                COALESCE((SELECT MIN(v.selling_price) FROM product_variants v WHERE v.product_id = p.id AND v.deleted_at IS NULL), p.selling_price) AS "minPrice",
                COALESCE((SELECT MAX(v.selling_price) FROM product_variants v WHERE v.product_id = p.id AND v.deleted_at IS NULL), p.selling_price) AS "maxPrice",
                COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl JOIN product_variants v ON v.id = sl.variant_id
                          WHERE v.product_id = p.id AND v.deleted_at IS NULL ${stockJoin}), 0)::int AS quantity,
                (SELECT url FROM product_photos ph WHERE ph.product_id = p.id ORDER BY ph.sort_order, ph.created_at LIMIT 1) AS "photoUrl"
         FROM products p
         LEFT JOIN product_categories c ON c.id = p.category_id
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE ${where.join(" AND ")}
       ) x
       ${stockWhere}
       ORDER BY ${SORT[f.sort]}
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<ProductListItemDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<ProductRow | null> {
    const rows: ProductRow[] = await db(tx).query(
      `SELECT p.id, p.name, p.category_id AS "categoryId", c.name AS "categoryName", p.brand, p.description, p.unit,
              p.cost_price AS "costPrice", p.selling_price AS "sellingPrice", p.reorder_level AS "reorderLevel",
              p.supplier_id AS "supplierId", s.name AS "supplierName", p.has_variants AS "hasVariants",
              p.is_active AS "isActive", p.created_at AS "createdAt", p.updated_at AS "updatedAt"
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.organization_id = $1 AND p.id = $2 AND p.deleted_at IS NULL`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async create(data: Omit<Product, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(ProductEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<Product>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(ProductEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(ProductEntity).softDelete({ id, organizationId });
    await tx.query(`UPDATE product_variants SET deleted_at = now() WHERE product_id = $1 AND deleted_at IS NULL`, [id]);
  }

  async totalStock(productId: string): Promise<number> {
    const rows: Array<{ quantity: number }> = await db().query(
      `SELECT COALESCE(SUM(sl.quantity), 0) AS quantity FROM stock_levels sl
       JOIN product_variants v ON v.id = sl.variant_id WHERE v.product_id = $1 AND v.deleted_at IS NULL`,
      [productId]
    );
    return Number(rows[0]?.quantity ?? 0);
  }

  async photos(productId: string): Promise<ProductPhotoDTO[]> {
    return db()
      .getRepository(ProductPhotoEntity)
      .find({ where: { productId }, select: ["id", "url", "publicId", "sortOrder"], order: { sortOrder: "ASC", createdAt: "ASC" }, take: 20 });
  }

  async addPhoto(productId: string, url: string, publicId: string, sortOrder: number): Promise<void> {
    await db().getRepository(ProductPhotoEntity).insert({ productId, url, publicId, sortOrder });
  }

  async findPhoto(productId: string, photoId: string): Promise<ProductPhotoDTO | null> {
    return db().getRepository(ProductPhotoEntity).findOne({ where: { id: photoId, productId }, select: ["id", "url", "publicId", "sortOrder"] });
  }

  async deletePhoto(photoId: string): Promise<void> {
    await db().getRepository(ProductPhotoEntity).delete({ id: photoId });
  }
}
