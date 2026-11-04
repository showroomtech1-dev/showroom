import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { num } from "../../../shared/utils/money";
import type { StockLevelRowDTO, StockMovementDTO, StockMoveInput } from "../dto/inventory.dto";
import { StockMovementEntity } from "../entities/stockMovement.entity";

export interface LevelFilter {
  page: number;
  limit: number;
  branchId: string | null;
  search?: string;
  categoryId?: string;
  supplierId?: string;
  status?: "low" | "out" | "in_stock" | "attention";
}

/** Effective reorder level: the variant's own, else the product's. */
const REORDER = "COALESCE(v.reorder_level, p.reorder_level)";

export class StockRepository {
  static Instance = new StockRepository();
  private constructor() {}

  /** Atomic `quantity += delta`; creates the level row on first use. Returns the new quantity. */
  async applyDelta(organizationId: string, branchId: string, variantId: string, delta: number, tx: Tx): Promise<number> {
    const rows: Array<{ quantity: number }> = await tx.query(
      `INSERT INTO stock_levels (organization_id, variant_id, branch_id, quantity) VALUES ($1, $2, $3, $4)
       ON CONFLICT (variant_id, branch_id)
       DO UPDATE SET quantity = stock_levels.quantity + EXCLUDED.quantity, updated_at = now()
       RETURNING quantity`,
      [organizationId, variantId, branchId, delta]
    );
    return num(rows[0]?.quantity);
  }

  async insertMovement(organizationId: string, createdById: string | null, m: StockMoveInput, balanceAfter: number, tx: Tx): Promise<void> {
    await tx.getRepository(StockMovementEntity).insert({
      organizationId,
      branchId: m.branchId,
      variantId: m.variantId,
      productId: m.productId,
      type: m.type,
      quantityChange: m.delta,
      balanceAfter,
      unitCost: m.unitCost,
      reason: m.reason ?? null,
      note: m.note?.slice(0, 255) ?? null,
      referenceType: m.referenceType ?? null,
      referenceId: m.referenceId ?? null,
      createdById,
    });
  }

  async quantity(variantId: string, branchId: string, tx?: Tx): Promise<number> {
    const rows: Array<{ quantity: number }> = await db(tx).query(
      `SELECT quantity FROM stock_levels WHERE variant_id = $1 AND branch_id = $2`,
      [variantId, branchId]
    );
    return num(rows[0]?.quantity);
  }

  /** Total on hand across every branch, with the variant row locked (weighted-average costing). */
  async totalQuantityForUpdate(variantId: string, tx: Tx): Promise<{ quantity: number; costPrice: number }> {
    const rows: Array<{ costPrice: number }> = await tx.query(
      `SELECT cost_price AS "costPrice" FROM product_variants WHERE id = $1 FOR UPDATE`,
      [variantId]
    );
    const qty: Array<{ quantity: number }> = await tx.query(
      `SELECT COALESCE(SUM(quantity), 0) AS quantity FROM stock_levels WHERE variant_id = $1`,
      [variantId]
    );
    return { quantity: num(qty[0]?.quantity), costPrice: num(rows[0]?.costPrice) };
  }

  async levels(organizationId: string, f: LevelFilter): Promise<PagedRows<StockLevelRowDTO>> {
    const p = new SqlParams();
    const org = p.add(organizationId);
    const branchJoin = f.branchId ? `AND sl.branch_id = ${p.add(f.branchId)}` : "";
    const where = [`v.organization_id = ${org}`, "v.deleted_at IS NULL", "p.deleted_at IS NULL", "p.is_active = true"];
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(p.name ILIKE ${s} OR v.sku ILIKE ${s} OR v.barcode ILIKE ${s} OR p.brand ILIKE ${s} OR v.name ILIKE ${s})`);
    }
    if (f.categoryId) where.push(`p.category_id = ${p.add(f.categoryId)}`);
    if (f.supplierId) where.push(`p.supplier_id = ${p.add(f.supplierId)}`);
    const having: Record<NonNullable<LevelFilter["status"]>, string> = {
      out: "q.quantity <= 0",
      low: `q.quantity > 0 AND q.quantity <= q."reorderLevel"`,
      in_stock: `q.quantity > q."reorderLevel"`,
      attention: `q.quantity <= q."reorderLevel"`,
    };
    const statusWhere = f.status ? `WHERE ${having[f.status]}` : "";
    const rows = await db().query(
      `SELECT q.*,
              CASE WHEN q.quantity <= 0 THEN 'out' WHEN q.quantity <= q."reorderLevel" THEN 'low' ELSE 'in_stock' END AS status,
              q.quantity * q."costPrice" AS "valueAtCost", q.quantity * q."sellingPrice" AS "valueAtSelling",
              COUNT(*) OVER() AS "__total"
       FROM (
         SELECT v.id AS "variantId", p.id AS "productId", p.name AS "productName", v.name AS "variantName", v.sku, v.barcode,
                c.name AS "categoryName", p.brand, p.unit,
                ${f.branchId ? `${p.add(f.branchId)}::uuid` : "NULL::uuid"} AS "branchId",
                ${f.branchId ? `(SELECT name FROM branches WHERE id = ${p.add(f.branchId)})` : "NULL"} AS "branchName",
                COALESCE(SUM(sl.quantity), 0)::int AS quantity, ${REORDER} AS "reorderLevel",
                v.cost_price AS "costPrice", v.selling_price AS "sellingPrice"
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         LEFT JOIN product_categories c ON c.id = p.category_id
         LEFT JOIN stock_levels sl ON sl.variant_id = v.id ${branchJoin}
         WHERE ${where.join(" AND ")}
         GROUP BY v.id, p.id, c.name
       ) q
       ${statusWhere}
       ORDER BY q."productName", q."variantName"
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<StockLevelRowDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  /** Stock of each variant per branch (product detail screen). */
  async byBranch(variantIds: string[]): Promise<Array<{ variantId: string; branchId: string; branchName: string; quantity: number }>> {
    if (variantIds.length === 0) return [];
    return db().query(
      `SELECT sl.variant_id AS "variantId", sl.branch_id AS "branchId", b.name AS "branchName", sl.quantity
       FROM stock_levels sl JOIN branches b ON b.id = sl.branch_id
       WHERE sl.variant_id = ANY($1::uuid[]) ORDER BY b.name`,
      [variantIds]
    );
  }

  async alertCounts(organizationId: string, branchId: string | null): Promise<{ low: number; out: number }> {
    const p = new SqlParams();
    const org = p.add(organizationId);
    const branchJoin = branchId ? `AND sl.branch_id = ${p.add(branchId)}` : "";
    const rows: Array<{ low: number; out: number }> = await db().query(
      `SELECT COUNT(*) FILTER (WHERE q.quantity > 0 AND q.quantity <= q.reorder) AS low,
              COUNT(*) FILTER (WHERE q.quantity <= 0) AS out
       FROM (
         SELECT COALESCE(SUM(sl.quantity), 0) AS quantity, ${REORDER} AS reorder
         FROM product_variants v JOIN products p ON p.id = v.product_id
         LEFT JOIN stock_levels sl ON sl.variant_id = v.id ${branchJoin}
         WHERE v.organization_id = ${org} AND v.deleted_at IS NULL AND p.deleted_at IS NULL AND p.is_active = true AND v.is_active = true
         GROUP BY v.id, p.reorder_level
       ) q`,
      p.values
    );
    return { low: num(rows[0]?.low), out: num(rows[0]?.out) };
  }

  /** Every (variant, branch) at or below its reorder level — feeds the notification scanner. */
  async attentionPerBranch(organizationId: string): Promise<
    Array<{ variantId: string; branchId: string; branchName: string; label: string; quantity: number; reorderLevel: number }>
  > {
    return db().query(
      `SELECT v.id AS "variantId", b.id AS "branchId", b.name AS "branchName",
              p.name || CASE WHEN v.name <> 'Default' THEN ' (' || v.name || ')' ELSE '' END AS label,
              COALESCE(sl.quantity, 0) AS quantity, ${REORDER} AS "reorderLevel"
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       JOIN branches b ON b.organization_id = v.organization_id AND b.deleted_at IS NULL AND b.is_active = true
       LEFT JOIN stock_levels sl ON sl.variant_id = v.id AND sl.branch_id = b.id
       WHERE v.organization_id = $1 AND v.deleted_at IS NULL AND v.is_active = true AND p.deleted_at IS NULL AND p.is_active = true
         AND ${REORDER} > 0 AND COALESCE(sl.quantity, 0) <= ${REORDER}
       LIMIT 2000`,
      [organizationId]
    );
  }

  async movements(
    organizationId: string,
    f: { page: number; limit: number; branchId: string | null; variantId?: string; productId?: string; type?: string; from?: string; to?: string; timezone: string }
  ): Promise<PagedRows<StockMovementDTO>> {
    const p = new SqlParams();
    const where = [`m.organization_id = ${p.add(organizationId)}`];
    if (f.branchId) where.push(`m.branch_id = ${p.add(f.branchId)}`);
    if (f.variantId) where.push(`m.variant_id = ${p.add(f.variantId)}`);
    if (f.productId) where.push(`m.product_id = ${p.add(f.productId)}`);
    if (f.type) where.push(`m.type = ${p.add(f.type)}`);
    if (f.from && f.to) {
      const tz = p.add(f.timezone);
      where.push(`m.created_at >= (CAST(${p.add(f.from)} AS date)::timestamp AT TIME ZONE ${tz})`);
      where.push(`m.created_at < ((CAST(${p.add(f.to)} AS date) + 1)::timestamp AT TIME ZONE ${tz})`);
    }
    const rows = await db().query(
      `SELECT m.id, m.created_at AS "createdAt", m.branch_id AS "branchId", b.name AS "branchName", m.variant_id AS "variantId",
              p.name AS "productName", v.name AS "variantName", v.sku, m.type, m.quantity_change AS "quantityChange",
              m.balance_after AS "balanceAfter", m.unit_cost AS "unitCost", m.reason, m.note,
              m.reference_type AS "referenceType", m.reference_id AS "referenceId", u.name AS "createdByName",
              COUNT(*) OVER() AS "__total"
       FROM stock_movements m
       JOIN product_variants v ON v.id = m.variant_id
       JOIN products p ON p.id = m.product_id
       JOIN branches b ON b.id = m.branch_id
       LEFT JOIN users u ON u.id = m.created_by_id
       WHERE ${where.join(" AND ")}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<StockMovementDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async valuation(organizationId: string, branchId: string | null) {
    const p = new SqlParams();
    const org = p.add(organizationId);
    const branchWhere = branchId ? `AND sl.branch_id = ${p.add(branchId)}` : "";
    const rows: Array<{ categoryName: string | null; units: number; items: number; valueAtCost: number; valueAtSelling: number }> =
      await db().query(
        `SELECT c.name AS "categoryName", COALESCE(SUM(sl.quantity), 0) AS units, COUNT(DISTINCT v.id) AS items,
                COALESCE(SUM(sl.quantity * v.cost_price), 0) AS "valueAtCost",
                COALESCE(SUM(sl.quantity * v.selling_price), 0) AS "valueAtSelling"
         FROM stock_levels sl
         JOIN product_variants v ON v.id = sl.variant_id AND v.deleted_at IS NULL
         JOIN products p ON p.id = v.product_id AND p.deleted_at IS NULL
         LEFT JOIN product_categories c ON c.id = p.category_id
         WHERE sl.organization_id = ${org} AND sl.quantity > 0 ${branchWhere}
         GROUP BY c.name
         ORDER BY "valueAtCost" DESC`,
        p.values
      );
    return rows.map((r) => ({ ...r, units: num(r.units), items: num(r.items), valueAtCost: num(r.valueAtCost), valueAtSelling: num(r.valueAtSelling) }));
  }
}
