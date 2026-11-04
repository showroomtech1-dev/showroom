import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { CustomerPaymentDTO } from "../dto/customer.dto";
import { CustomerPaymentEntity, type CustomerPayment } from "../entities/customerPayment.entity";
import { CustomerPaymentAllocationEntity } from "../entities/customerPaymentAllocation.entity";

const SELECT = `
  SELECT p.id, p.code, p.customer_id AS "customerId", c.name AS "customerName", p.branch_id AS "branchId",
         p.payment_date AS "paymentDate", p.amount, p.method, p.account_id AS "accountId", a.name AS "accountName",
         p.reference, p.notes, p.allocated_amount AS "allocatedAmount", p.amount - p.allocated_amount AS unallocated,
         u.name AS "createdByName", p.created_at AS "createdAt"
  FROM customer_payments p
  JOIN customers c ON c.id = p.customer_id
  JOIN accounts a ON a.id = p.account_id
  LEFT JOIN users u ON u.id = p.created_by_id`;

export class CustomerPaymentRepository {
  static Instance = new CustomerPaymentRepository();
  private constructor() {}

  async list(
    organizationId: string,
    f: { page: number; limit: number; search?: string; customerId?: string; method?: string; branchId: string | null; from?: string; to?: string }
  ): Promise<PagedRows<CustomerPaymentDTO>> {
    const p = new SqlParams();
    const where = [`p.organization_id = ${p.add(organizationId)}`, "p.deleted_at IS NULL"];
    if (f.customerId) where.push(`p.customer_id = ${p.add(f.customerId)}`);
    if (f.method) where.push(`p.method = ${p.add(f.method)}`);
    if (f.branchId) where.push(`p.branch_id = ${p.add(f.branchId)}`);
    if (f.from) where.push(`p.payment_date >= ${p.add(f.from)}`);
    if (f.to) where.push(`p.payment_date <= ${p.add(f.to)}`);
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(p.code ILIKE ${s} OR p.reference ILIKE ${s} OR c.name ILIKE ${s} OR c.phone ILIKE ${s})`);
    }
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT} WHERE ${where.join(" AND ")}) x
       ORDER BY x."paymentDate" DESC, x."createdAt" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<CustomerPaymentDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<CustomerPaymentDTO | null> {
    const rows: CustomerPaymentDTO[] = await db(tx).query(`${SELECT} WHERE p.organization_id = $1 AND p.id = $2 AND p.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  async findIdByClientRef(organizationId: string, clientRef: string): Promise<string | null> {
    const row = await db().getRepository(CustomerPaymentEntity).findOne({ where: { organizationId, clientRef }, select: ["id"], withDeleted: true });
    return row?.id ?? null;
  }

  async allocations(paymentId: string, tx?: Tx): Promise<NonNullable<CustomerPaymentDTO["allocations"]>> {
    return db(tx).query(
      `SELECT a.sale_id AS "saleId", s.code AS "saleCode", a.amount FROM customer_payment_allocations a
       JOIN sales s ON s.id = a.sale_id WHERE a.payment_id = $1 ORDER BY s.sold_at`,
      [paymentId]
    );
  }

  async create(data: Omit<CustomerPayment, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(CustomerPaymentEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(CustomerPaymentEntity).softDelete({ id, organizationId });
  }

  async lock(id: string, tx: Tx): Promise<void> {
    await tx.query(`SELECT id FROM customer_payments WHERE id = $1 FOR UPDATE`, [id]);
  }

  async insertAllocation(paymentId: string, saleId: string, amount: number, tx: Tx): Promise<void> {
    await tx.getRepository(CustomerPaymentAllocationEntity).insert({ paymentId, saleId, amount });
  }

  async allocationsOfPayment(paymentId: string, tx: Tx): Promise<Array<{ id: string; saleId: string; amount: number }>> {
    return tx.query(`SELECT id, sale_id AS "saleId", amount FROM customer_payment_allocations WHERE payment_id = $1`, [paymentId]);
  }

  async allocationsOfSale(saleId: string, tx: Tx): Promise<Array<{ id: string; paymentId: string; amount: number }>> {
    return tx.query(`SELECT id, payment_id AS "paymentId", amount FROM customer_payment_allocations WHERE sale_id = $1`, [saleId]);
  }

  async deleteAllocations(ids: string[], tx: Tx): Promise<void> {
    if (ids.length > 0) await tx.query(`DELETE FROM customer_payment_allocations WHERE id = ANY($1::uuid[])`, [ids]);
  }

  async applyAllocated(paymentId: string, delta: number, tx: Tx): Promise<void> {
    await tx.query(`UPDATE customer_payments SET allocated_amount = allocated_amount + $2, updated_at = now() WHERE id = $1`, [paymentId, delta]);
  }

  async withCreditForUpdate(customerId: string, tx: Tx): Promise<Array<{ id: string; amount: number; allocatedAmount: number }>> {
    return tx.query(
      `SELECT id, amount, allocated_amount AS "allocatedAmount" FROM customer_payments
       WHERE customer_id = $1 AND deleted_at IS NULL AND allocated_amount < amount
       ORDER BY payment_date, created_at FOR UPDATE`,
      [customerId]
    );
  }
}
