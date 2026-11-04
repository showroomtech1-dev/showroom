import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { OpenSupplyRow, SupplyAllocationDTO, SupplyItemDTO, SupplyListItemDTO } from "../dto/supply.dto";
import { SupplyEntity, type Supply } from "../entities/supply.entity";
import { SupplyItemEntity, type SupplyItem } from "../entities/supplyItem.entity";

export interface SupplyListFilter {
  page: number;
  limit: number;
  search?: string;
  supplierId?: string;
  branchId: string | null;
  status?: "paid" | "part_paid" | "credit" | "unpaid" | "overdue";
  from?: string;
  to?: string;
}

const listSelect = (todayParam: string) => `
  SELECT x.id, x.code, x.supplier_id AS "supplierId", s.name AS "supplierName", s.type AS "supplierType",
         x.branch_id AS "branchId", b.name AS "branchName", x.invoice_number AS "invoiceNumber",
         x.supply_date AS "supplyDate", x.due_date AS "dueDate", x.subtotal, x.discount, x.total_cost AS "totalCost",
         x.amount_paid AS "amountPaid", x.total_cost - x.amount_paid AS outstanding, x.payment_status AS "paymentStatus",
         (x.amount_paid < x.total_cost AND x.due_date < ${todayParam}::date) AS "isOverdue",
         (SELECT COUNT(*) FROM supply_items i WHERE i.supply_id = x.id)::int AS "itemCount",
         x.notes, u.name AS "createdByName", x.created_at AS "createdAt"
  FROM supplies x
  JOIN suppliers s ON s.id = x.supplier_id
  JOIN branches b ON b.id = x.branch_id
  LEFT JOIN users u ON u.id = x.created_by_id`;

export class SupplyRepository {
  static Instance = new SupplyRepository();
  private constructor() {}

  async list(organizationId: string, f: SupplyListFilter, today: string): Promise<PagedRows<SupplyListItemDTO>> {
    const p = new SqlParams();
    const todayParam = p.add(today);
    const where = [`x.organization_id = ${p.add(organizationId)}`, "x.deleted_at IS NULL"];
    if (f.supplierId) where.push(`x.supplier_id = ${p.add(f.supplierId)}`);
    if (f.branchId) where.push(`x.branch_id = ${p.add(f.branchId)}`);
    if (f.from) where.push(`x.supply_date >= ${p.add(f.from)}`);
    if (f.to) where.push(`x.supply_date <= ${p.add(f.to)}`);
    if (f.status === "unpaid") where.push("x.amount_paid < x.total_cost");
    else if (f.status === "overdue") where.push(`x.amount_paid < x.total_cost AND x.due_date < ${todayParam}::date`);
    else if (f.status) where.push(`x.payment_status = ${p.add(f.status)}`);
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(x.code ILIKE ${s} OR x.invoice_number ILIKE ${s} OR s.name ILIKE ${s})`);
    }
    const rows = await db().query(
      `SELECT q.*, COUNT(*) OVER() AS "__total" FROM (${listSelect(todayParam)} WHERE ${where.join(" AND ")}) q
       ORDER BY q."supplyDate" DESC, q."createdAt" DESC
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<SupplyListItemDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, today: string, tx?: Tx): Promise<(SupplyListItemDTO & { subtotal: number; discount: number; notes: string | null }) | null> {
    const rows = await db(tx).query(`${listSelect("$3")} WHERE x.organization_id = $1 AND x.id = $2 AND x.deleted_at IS NULL`, [organizationId, id, today]);
    return rows[0] ?? null;
  }

  async items(supplyId: string, tx?: Tx): Promise<SupplyItemDTO[]> {
    return db(tx).query(
      `SELECT i.id, i.variant_id AS "variantId", i.product_id AS "productId", i.description, v.sku,
              i.quantity, i.unit_cost AS "unitCost", i.total_cost AS "totalCost"
       FROM supply_items i LEFT JOIN product_variants v ON v.id = i.variant_id
       WHERE i.supply_id = $1 ORDER BY i.description`,
      [supplyId]
    );
  }

  async allocations(supplyId: string): Promise<SupplyAllocationDTO[]> {
    return db().query(
      `SELECT p.id AS "paymentId", p.code AS "paymentCode", p.payment_date AS "paymentDate", p.method, a.amount
       FROM supplier_payment_allocations a JOIN supplier_payments p ON p.id = a.payment_id
       WHERE a.supply_id = $1 AND p.deleted_at IS NULL ORDER BY p.payment_date, a.created_at`,
      [supplyId]
    );
  }

  async create(data: Omit<Supply, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(SupplyEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async insertItems(items: Array<Omit<SupplyItem, "id">>, tx: Tx): Promise<void> {
    if (items.length > 0) await tx.getRepository(SupplyItemEntity).insert(items);
  }

  async update(organizationId: string, id: string, data: Partial<Supply>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(SupplyEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(SupplyEntity).softDelete({ id, organizationId });
  }

  async lock(id: string, tx: Tx): Promise<void> {
    await tx.query(`SELECT id FROM supplies WHERE id = $1 FOR UPDATE`, [id]);
  }

  /** A supplier's unpaid supplies, locked, in allocation order (preferred first, then oldest due). */
  async openForUpdate(supplierId: string, preferredId: string | null, tx: Tx): Promise<OpenSupplyRow[]> {
    return tx.query(
      `SELECT id, total_cost AS "totalCost", amount_paid AS "amountPaid"
       FROM supplies
       WHERE supplier_id = $1 AND deleted_at IS NULL AND amount_paid < total_cost
       ORDER BY (id = $2::uuid) DESC, due_date NULLS LAST, supply_date, created_at
       FOR UPDATE`,
      [supplierId, preferredId]
    );
  }

  /** Adds `delta` to amount_paid and recomputes the payment status. */
  async applyPaid(supplyId: string, delta: number, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE supplies SET amount_paid = amount_paid + $2,
              payment_status = CASE WHEN amount_paid + $2 >= total_cost THEN 'paid'
                                    WHEN amount_paid + $2 > 0 THEN 'part_paid' ELSE 'credit' END,
              updated_at = now()
       WHERE id = $1`,
      [supplyId, delta]
    );
  }
}
