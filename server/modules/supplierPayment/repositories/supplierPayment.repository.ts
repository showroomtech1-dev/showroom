import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { SupplierPaymentDetailDTO, SupplierPaymentDTO, UnallocatedPaymentRow } from "../dto/supplierPayment.dto";
import { SupplierPaymentEntity, type SupplierPayment } from "../entities/supplierPayment.entity";
import { SupplierPaymentAllocationEntity } from "../entities/supplierPaymentAllocation.entity";

const SELECT = `
  SELECT p.id, p.code, p.supplier_id AS "supplierId", s.name AS "supplierName", s.type AS "supplierType", p.branch_id AS "branchId",
         p.payment_date AS "paymentDate", p.amount, p.method, p.account_id AS "accountId", a.name AS "accountName",
         p.reference, p.notes, p.proof_url AS "proofUrl", p.proof_public_id AS "proofPublicId",
         p.allocated_amount AS "allocatedAmount", p.is_overpayment AS "isOverpayment", p.overpaid_amount AS "overpaidAmount",
         u.name AS "createdByName", p.created_at AS "createdAt"
  FROM supplier_payments p
  JOIN suppliers s ON s.id = p.supplier_id
  JOIN accounts a ON a.id = p.account_id
  LEFT JOIN users u ON u.id = p.created_by_id`;

export interface PaymentListFilter {
  page: number;
  limit: number;
  search?: string;
  supplierId?: string;
  method?: string;
  overpaymentsOnly?: boolean;
  from?: string;
  to?: string;
}

export class SupplierPaymentRepository {
  static Instance = new SupplierPaymentRepository();
  private constructor() {}

  async list(organizationId: string, f: PaymentListFilter): Promise<PagedRows<SupplierPaymentDTO>> {
    const p = new SqlParams();
    const where = [`p.organization_id = ${p.add(organizationId)}`, "p.deleted_at IS NULL"];
    if (f.supplierId) where.push(`p.supplier_id = ${p.add(f.supplierId)}`);
    if (f.method) where.push(`p.method = ${p.add(f.method)}`);
    if (f.overpaymentsOnly) where.push("p.is_overpayment = true");
    if (f.from) where.push(`p.payment_date >= ${p.add(f.from)}`);
    if (f.to) where.push(`p.payment_date <= ${p.add(f.to)}`);
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(p.code ILIKE ${s} OR p.reference ILIKE ${s} OR s.name ILIKE ${s})`);
    }
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT} WHERE ${where.join(" AND ")}) x
       ORDER BY x."paymentDate" DESC, x."createdAt" DESC
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<SupplierPaymentDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<SupplierPaymentDTO | null> {
    const rows: SupplierPaymentDTO[] = await db(tx).query(`${SELECT} WHERE p.organization_id = $1 AND p.id = $2 AND p.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  async findByClientRef(organizationId: string, clientRef: string): Promise<{ id: string } | null> {
    return db().getRepository(SupplierPaymentEntity).findOne({ where: { organizationId, clientRef }, select: ["id"], withDeleted: true });
  }

  async allocations(paymentId: string, tx?: Tx): Promise<SupplierPaymentDetailDTO["allocations"]> {
    return db(tx).query(
      `SELECT a.supply_id AS "supplyId", x.code AS "supplyCode", x.invoice_number AS "invoiceNumber", x.supply_date AS "supplyDate", a.amount
       FROM supplier_payment_allocations a JOIN supplies x ON x.id = a.supply_id
       WHERE a.payment_id = $1 ORDER BY x.supply_date`,
      [paymentId]
    );
  }

  async create(data: Omit<SupplierPayment, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(SupplierPaymentEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<SupplierPayment>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(SupplierPaymentEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(SupplierPaymentEntity).softDelete({ id, organizationId });
  }

  async lock(id: string, tx: Tx): Promise<void> {
    await tx.query(`SELECT id FROM supplier_payments WHERE id = $1 FOR UPDATE`, [id]);
  }

  async insertAllocation(paymentId: string, supplyId: string, amount: number, tx: Tx): Promise<void> {
    await tx.getRepository(SupplierPaymentAllocationEntity).insert({ paymentId, supplyId, amount });
  }

  async allocationsOfPayment(paymentId: string, tx: Tx): Promise<Array<{ id: string; supplyId: string; amount: number }>> {
    return tx.query(`SELECT id, supply_id AS "supplyId", amount FROM supplier_payment_allocations WHERE payment_id = $1`, [paymentId]);
  }

  async allocationsOfSupply(supplyId: string, tx: Tx): Promise<Array<{ id: string; paymentId: string; amount: number }>> {
    return tx.query(`SELECT id, payment_id AS "paymentId", amount FROM supplier_payment_allocations WHERE supply_id = $1`, [supplyId]);
  }

  async deleteAllocations(ids: string[], tx: Tx): Promise<void> {
    if (ids.length > 0) await tx.query(`DELETE FROM supplier_payment_allocations WHERE id = ANY($1::uuid[])`, [ids]);
  }

  /** Adds `delta` to allocated_amount and keeps overpaid_amount = amount − allocated. */
  async applyAllocated(paymentId: string, delta: number, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE supplier_payments SET allocated_amount = allocated_amount + $2,
              overpaid_amount = amount - (allocated_amount + $2), updated_at = now()
       WHERE id = $1`,
      [paymentId, delta]
    );
  }

  /** Payments of a supplier that still have unapplied credit, oldest first, locked. */
  async withCreditForUpdate(supplierId: string, tx: Tx): Promise<UnallocatedPaymentRow[]> {
    return tx.query(
      `SELECT id, amount, allocated_amount AS "allocatedAmount" FROM supplier_payments
       WHERE supplier_id = $1 AND deleted_at IS NULL AND allocated_amount < amount
       ORDER BY payment_date, created_at FOR UPDATE`,
      [supplierId]
    );
  }
}
