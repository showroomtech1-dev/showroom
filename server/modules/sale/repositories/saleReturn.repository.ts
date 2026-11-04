import { SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { SaleReturnDTO } from "../dto/sale.dto";
import { SaleReturnEntity, type SaleReturn } from "../entities/saleReturn.entity";
import { SaleReturnItemEntity, type SaleReturnItem } from "../entities/saleReturnItem.entity";

const SELECT = `
  SELECT r.id, r.code, r.sale_id AS "saleId", s.code AS "saleCode", r.branch_id AS "branchId", c.name AS "customerName",
         r.return_date AS "returnDate", r.reason, r.total_value AS "totalValue", r.tax_reversed AS "taxReversed",
         r.cost_reversed AS "costReversed", r.applied_to_balance AS "appliedToBalance", r.refund_amount AS "refundAmount",
         r.refund_method AS "refundMethod", u.name AS "processedByName", r.created_at AS "createdAt"
  FROM sale_returns r
  JOIN sales s ON s.id = r.sale_id
  LEFT JOIN customers c ON c.id = s.customer_id
  LEFT JOIN users u ON u.id = r.processed_by_id`;

export class SaleReturnRepository {
  static Instance = new SaleReturnRepository();
  private constructor() {}

  async list(organizationId: string, f: { page: number; limit: number; saleId?: string; branchId: string | null; from?: string; to?: string }): Promise<PagedRows<SaleReturnDTO>> {
    const p = new SqlParams();
    const where = [`r.organization_id = ${p.add(organizationId)}`, "r.deleted_at IS NULL"];
    if (f.saleId) where.push(`r.sale_id = ${p.add(f.saleId)}`);
    if (f.branchId) where.push(`r.branch_id = ${p.add(f.branchId)}`);
    if (f.from) where.push(`r.return_date >= ${p.add(f.from)}`);
    if (f.to) where.push(`r.return_date <= ${p.add(f.to)}`);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT} WHERE ${where.join(" AND ")}) x
       ORDER BY x."createdAt" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<SaleReturnDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string): Promise<SaleReturnDTO | null> {
    const rows: SaleReturnDTO[] = await db().query(`${SELECT} WHERE r.organization_id = $1 AND r.id = $2 AND r.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  async items(returnId: string): Promise<NonNullable<SaleReturnDTO["items"]>> {
    return db().query(
      `SELECT ri.sale_item_id AS "saleItemId", si.product_name AS "productName", si.variant_name AS "variantName",
              ri.quantity, ri.line_value AS "lineValue", ri.restock
       FROM sale_return_items ri JOIN sale_items si ON si.id = ri.sale_item_id WHERE ri.return_id = $1`,
      [returnId]
    );
  }

  async create(data: Omit<SaleReturn, "id" | "createdAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(SaleReturnEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async insertItems(items: Array<Omit<SaleReturnItem, "id">>, tx: Tx): Promise<void> {
    await tx.getRepository(SaleReturnItemEntity).insert(items);
  }
}
