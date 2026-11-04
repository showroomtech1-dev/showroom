import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { StockTakeDTO, StockTakeItemDTO } from "../dto/inventory.dto";
import { StockTakeEntity, type StockTake } from "../entities/stockTake.entity";

const SELECT_TAKE = `
  SELECT t.id, t.code, t.branch_id AS "branchId", b.name AS "branchName", t.status, t.notes,
         t.items_counted AS "itemsCounted",
         (SELECT COUNT(*) FROM stock_take_items i WHERE i.stock_take_id = t.id)::int AS "totalItems",
         t.variance_quantity AS "varianceQuantity", t.variance_value AS "varianceValue",
         cu.name AS "createdByName", cc.name AS "completedByName", t.completed_at AS "completedAt", t.created_at AS "createdAt"
  FROM stock_takes t
  JOIN branches b ON b.id = t.branch_id
  LEFT JOIN users cu ON cu.id = t.created_by_id
  LEFT JOIN users cc ON cc.id = t.completed_by_id`;

export class StockTakeRepository {
  static Instance = new StockTakeRepository();
  private constructor() {}

  async create(data: Pick<StockTake, "organizationId" | "branchId" | "code" | "notes" | "createdById">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(StockTakeEntity);
    const saved = await repo.save(repo.create({ ...data, status: "in_progress" }));
    return saved.id;
  }

  /** Snapshot current system quantities of every active variant (optionally one category) into the count sheet. */
  async snapshotItems(stockTakeId: string, organizationId: string, branchId: string, categoryId: string | undefined, tx: Tx): Promise<number> {
    const rows: Array<{ id: string }> = await tx.query(
      `INSERT INTO stock_take_items (stock_take_id, variant_id, product_id, system_quantity, unit_cost)
       SELECT $1, v.id, v.product_id, COALESCE(sl.quantity, 0), v.cost_price
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       LEFT JOIN stock_levels sl ON sl.variant_id = v.id AND sl.branch_id = $3
       WHERE v.organization_id = $2 AND v.deleted_at IS NULL AND v.is_active AND p.deleted_at IS NULL AND p.is_active
         AND ($4::uuid IS NULL OR p.category_id = $4::uuid)
       RETURNING id`,
      [stockTakeId, organizationId, branchId, categoryId ?? null]
    );
    return rows.length;
  }

  async list(organizationId: string, f: { page: number; limit: number; branchId: string | null; status?: string }): Promise<PagedRows<StockTakeDTO>> {
    const p = new SqlParams();
    const where = [`t.organization_id = ${p.add(organizationId)}`, "t.deleted_at IS NULL"];
    if (f.branchId) where.push(`t.branch_id = ${p.add(f.branchId)}`);
    if (f.status) where.push(`t.status = ${p.add(f.status)}`);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT_TAKE} WHERE ${where.join(" AND ")}) x
       ORDER BY x."createdAt" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<StockTakeDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx, lock = false): Promise<StockTakeDTO | null> {
    if (lock && tx) await tx.query(`SELECT id FROM stock_takes WHERE id = $1 FOR UPDATE`, [id]);
    const rows: StockTakeDTO[] = await db(tx).query(
      `${SELECT_TAKE} WHERE t.organization_id = $1 AND t.id = $2 AND t.deleted_at IS NULL`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async items(stockTakeId: string, f: { page: number; limit: number; search?: string; uncountedOnly?: boolean }): Promise<PagedRows<StockTakeItemDTO>> {
    const p = new SqlParams();
    const where = [`i.stock_take_id = ${p.add(stockTakeId)}`];
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(pr.name ILIKE ${s} OR v.sku ILIKE ${s} OR v.barcode ILIKE ${s})`);
    }
    if (f.uncountedOnly) where.push("i.counted_quantity IS NULL");
    const rows = await db().query(
      `SELECT i.id, i.variant_id AS "variantId", i.product_id AS "productId", pr.name AS "productName", v.name AS "variantName",
              v.sku, i.system_quantity AS "systemQuantity", i.counted_quantity AS "countedQuantity", i.variance,
              i.unit_cost AS "unitCost", i.counted_at AS "countedAt", COUNT(*) OVER() AS "__total"
       FROM stock_take_items i
       JOIN product_variants v ON v.id = i.variant_id
       JOIN products pr ON pr.id = i.product_id
       WHERE ${where.join(" AND ")}
       ORDER BY pr.name, v.name
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<StockTakeItemDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  /** Saves counts; returns how many rows matched the sheet. */
  async recordCounts(stockTakeId: string, counts: Array<{ variantId: string; countedQuantity: number }>, tx: Tx): Promise<number> {
    let matched = 0;
    for (const c of counts) {
      const rows: Array<{ id: string }> = await tx.query(
        `UPDATE stock_take_items SET counted_quantity = $3, variance = $3 - system_quantity, counted_at = now()
         WHERE stock_take_id = $1 AND variant_id = $2 RETURNING id`,
        [stockTakeId, c.variantId, c.countedQuantity]
      );
      matched += rows.length;
    }
    await tx.query(
      `UPDATE stock_takes SET items_counted = (SELECT COUNT(*) FROM stock_take_items WHERE stock_take_id = $1 AND counted_quantity IS NOT NULL), updated_at = now()
       WHERE id = $1`,
      [stockTakeId]
    );
    return matched;
  }

  async countedItems(stockTakeId: string, tx: Tx): Promise<Array<{ variantId: string; productId: string; countedQuantity: number; unitCost: number; label: string }>> {
    return tx.query(
      `SELECT i.variant_id AS "variantId", i.product_id AS "productId", i.counted_quantity AS "countedQuantity",
              i.unit_cost AS "unitCost", pr.name || CASE WHEN v.name <> 'Default' THEN ' (' || v.name || ')' ELSE '' END AS label
       FROM stock_take_items i JOIN product_variants v ON v.id = i.variant_id JOIN products pr ON pr.id = i.product_id
       WHERE i.stock_take_id = $1 AND i.counted_quantity IS NOT NULL`,
      [stockTakeId]
    );
  }

  async setItemVariance(stockTakeId: string, variantId: string, systemQuantity: number, variance: number, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE stock_take_items SET system_quantity = $3, variance = $4 WHERE stock_take_id = $1 AND variant_id = $2`,
      [stockTakeId, variantId, systemQuantity, variance]
    );
  }

  async finish(id: string, data: Partial<StockTake>, tx: Tx): Promise<void> {
    await tx.getRepository(StockTakeEntity).update({ id }, data);
  }
}
