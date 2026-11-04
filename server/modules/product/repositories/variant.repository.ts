import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import type { PosItemDTO, SellableVariant, VariantDTO } from "../dto/product.dto";
import { ProductVariantEntity, type ProductVariant } from "../entities/productVariant.entity";

const SELLABLE = `
  SELECT v.id, v.product_id AS "productId", p.name AS "productName", v.name AS "variantName",
         p.name || CASE WHEN v.name <> 'Default' THEN ' (' || v.name || ')' ELSE '' END AS label,
         v.sku, v.barcode, v.cost_price AS "costPrice", v.selling_price AS "sellingPrice", p.unit,
         (v.is_active AND p.is_active) AS "isActive"
  FROM product_variants v JOIN products p ON p.id = v.product_id`;

export class VariantRepository {
  static Instance = new VariantRepository();
  private constructor() {}

  async findForSale(organizationId: string, variantId: string, tx?: Tx): Promise<SellableVariant | null> {
    const rows: SellableVariant[] = await db(tx).query(
      `${SELLABLE} WHERE v.organization_id = $1 AND v.id = $2 AND v.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [organizationId, variantId]
    );
    return rows[0] ?? null;
  }

  async findManyForSale(organizationId: string, variantIds: string[], tx?: Tx): Promise<Map<string, SellableVariant>> {
    const rows: SellableVariant[] = await db(tx).query(
      `${SELLABLE} WHERE v.organization_id = $1 AND v.id = ANY($2::uuid[]) AND v.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [organizationId, variantIds]
    );
    return new Map(rows.map((r) => [r.id, r]));
  }

  async listByProduct(productId: string, tx?: Tx): Promise<VariantDTO[]> {
    return db(tx).query(
      `SELECT v.id, v.product_id AS "productId", v.name, v.size, v.color, v.model, v.sku, v.barcode,
              v.cost_price AS "costPrice", v.selling_price AS "sellingPrice", v.reorder_level AS "reorderLevel",
              v.is_active AS "isActive",
              COALESCE((SELECT SUM(quantity) FROM stock_levels sl WHERE sl.variant_id = v.id), 0)::int AS quantity
       FROM product_variants v WHERE v.product_id = $1 AND v.deleted_at IS NULL
       ORDER BY v.created_at LIMIT 200`,
      [productId]
    );
  }

  async skuTaken(organizationId: string, sku: string, exceptId?: string): Promise<boolean> {
    const rows: Array<{ id: string }> = await db().query(
      `SELECT id FROM product_variants WHERE organization_id = $1 AND lower(sku) = lower($2) AND deleted_at IS NULL
         AND ($3::uuid IS NULL OR id <> $3::uuid) LIMIT 1`,
      [organizationId, sku, exceptId ?? null]
    );
    return rows.length > 0;
  }

  async barcodeTaken(organizationId: string, barcode: string, exceptId?: string): Promise<boolean> {
    const rows: Array<{ id: string }> = await db().query(
      `SELECT id FROM product_variants WHERE organization_id = $1 AND barcode = $2 AND deleted_at IS NULL
         AND ($3::uuid IS NULL OR id <> $3::uuid) LIMIT 1`,
      [organizationId, barcode, exceptId ?? null]
    );
    return rows.length > 0;
  }

  async create(data: Omit<ProductVariant, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(ProductVariantEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<ProductVariant>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(ProductVariantEntity).update({ id, organizationId }, data);
  }

  async updatePricesForProduct(productId: string, prices: { costPrice?: number; sellingPrice?: number }, tx: Tx): Promise<void> {
    await tx.getRepository(ProductVariantEntity).update({ productId }, prices);
  }

  async updateCost(variantId: string, costPrice: number, tx: Tx): Promise<void> {
    await tx.getRepository(ProductVariantEntity).update({ id: variantId }, { costPrice });
  }

  async softDelete(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(ProductVariantEntity).softDelete({ id, organizationId });
  }

  /** POS search by name / SKU / barcode with on-hand quantity at the branch. Exact code matches first. */
  async posSearch(organizationId: string, branchId: string, q: string, limit: number): Promise<PosItemDTO[]> {
    const p = new SqlParams();
    const org = p.add(organizationId);
    const branch = p.add(branchId);
    const exact = p.add(q);
    const like = p.add(likePattern(q));
    return db().query(
      `SELECT v.id AS "variantId", p.id AS "productId", p.name AS "productName", v.name AS "variantName",
              p.name || CASE WHEN v.name <> 'Default' THEN ' (' || v.name || ')' ELSE '' END AS label,
              v.sku, v.barcode, p.unit, v.selling_price AS "sellingPrice",
              COALESCE(sl.quantity, 0) AS quantity,
              (SELECT url FROM product_photos ph WHERE ph.product_id = p.id ORDER BY ph.sort_order, ph.created_at LIMIT 1) AS "photoUrl"
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       LEFT JOIN stock_levels sl ON sl.variant_id = v.id AND sl.branch_id = ${branch}
       WHERE v.organization_id = ${org} AND v.deleted_at IS NULL AND p.deleted_at IS NULL AND v.is_active AND p.is_active
         AND (v.barcode = ${exact} OR lower(v.sku) = lower(${exact}) OR p.name ILIKE ${like} OR v.name ILIKE ${like}
              OR v.sku ILIKE ${like} OR p.brand ILIKE ${like})
       ORDER BY (v.barcode = ${exact} OR lower(v.sku) = lower(${exact})) DESC, p.name, v.name
       LIMIT ${p.add(limit)}`,
      p.values
    );
  }

  async findByBarcode(organizationId: string, branchId: string, code: string): Promise<PosItemDTO | null> {
    const rows = await this.posSearch(organizationId, branchId, code, 5);
    return rows.find((r) => r.barcode === code || r.sku.toLowerCase() === code.toLowerCase()) ?? null;
  }
}
