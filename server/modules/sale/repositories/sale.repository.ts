import { likePattern, SqlParams, tzDateBetween } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { OpenSaleRow } from "../../customer/dto/customer.dto";
import type { SaleDetailDTO, SaleHeaderDTO, SaleItemDTO, SalePaymentDTO } from "../dto/sale.dto";
import { SaleEntity, type Sale } from "../entities/sale.entity";
import { SaleItemEntity, type SaleItem } from "../entities/saleItem.entity";
import { SalePaymentEntity, type SalePayment } from "../entities/salePayment.entity";

const HEADER = `
  SELECT s.id, s.code, s.branch_id AS "branchId", b.name AS "branchName", s.customer_id AS "customerId",
         c.name AS "customerName", c.phone AS "customerPhone", s.sold_by_id AS "soldById", u.name AS "soldByName",
         s.sold_at AS "soldAt", s.status, s.subtotal, s.discount_total AS "discountTotal", s.tax_rate_bps AS "taxRateBps",
         s.tax_amount AS "taxAmount", s.total, s.amount_paid AS "amountPaid", s.balance_due AS "balanceDue",
         s.payment_status AS "paymentStatus", s.due_date AS "dueDate", s.cost_total AS "costTotal",
         s.commission_rate_bps AS "commissionRateBps", s.commission_amount AS "commissionAmount",
         s.returned_amount AS "returnedAmount", s.notes, s.receipt_token AS "receiptToken", s.quotation_id AS "quotationId",
         s.voided_at AS "voidedAt", s.void_reason AS "voidReason",
         (SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id)::int AS "itemCount", s.created_at AS "createdAt"
  FROM sales s
  JOIN branches b ON b.id = s.branch_id
  JOIN users u ON u.id = s.sold_by_id
  LEFT JOIN customers c ON c.id = s.customer_id`;

export interface SaleListFilter {
  page: number;
  limit: number;
  search?: string;
  branchId: string | null;
  soldById: string | null;
  customerId?: string;
  status?: "completed" | "voided";
  paymentStatus?: "paid" | "part_paid" | "credit" | "unpaid";
  from?: string;
  to?: string;
  timezone: string;
}

export class SaleRepository {
  static Instance = new SaleRepository();
  private constructor() {}

  async list(organizationId: string, f: SaleListFilter): Promise<PagedRows<SaleHeaderDTO>> {
    const p = new SqlParams();
    const where = [`s.organization_id = ${p.add(organizationId)}`, "s.deleted_at IS NULL"];
    if (f.branchId) where.push(`s.branch_id = ${p.add(f.branchId)}`);
    if (f.soldById) where.push(`s.sold_by_id = ${p.add(f.soldById)}`);
    if (f.customerId) where.push(`s.customer_id = ${p.add(f.customerId)}`);
    if (f.status) where.push(`s.status = ${p.add(f.status)}`);
    if (f.paymentStatus === "unpaid") where.push("s.balance_due > 0");
    else if (f.paymentStatus) where.push(`s.payment_status = ${p.add(f.paymentStatus)}`);
    if (f.from && f.to) where.push(tzDateBetween("s.sold_at", p.add(f.from), p.add(f.to), p.add(f.timezone)));
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(s.code ILIKE ${s} OR c.name ILIKE ${s} OR c.phone ILIKE ${s})`);
    }
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${HEADER} WHERE ${where.join(" AND ")}) x
       ORDER BY x."soldAt" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<SaleHeaderDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<SaleHeaderDTO | null> {
    const rows: SaleHeaderDTO[] = await db(tx).query(`${HEADER} WHERE s.organization_id = $1 AND s.id = $2 AND s.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  async findByReceiptToken(token: string): Promise<(SaleHeaderDTO & { organizationId: string }) | null> {
    const rows = await db().query(
      `SELECT x.*, s2.organization_id AS "organizationId" FROM (${HEADER} WHERE s.receipt_token = $1 AND s.deleted_at IS NULL) x
       JOIN sales s2 ON s2.id = x.id`,
      [token]
    );
    return rows[0] ?? null;
  }

  async findIdByClientRef(organizationId: string, clientRef: string): Promise<string | null> {
    const row = await db().getRepository(SaleEntity).findOne({ where: { organizationId, clientRef }, select: ["id"], withDeleted: true });
    return row?.id ?? null;
  }

  async items(saleId: string, tx?: Tx): Promise<SaleItemDTO[]> {
    return db(tx).query(
      `SELECT id, variant_id AS "variantId", product_id AS "productId", product_name AS "productName", variant_name AS "variantName",
              sku, quantity, unit_price AS "unitPrice", list_price AS "listPrice", discount, line_total AS "lineTotal",
              unit_cost AS "unitCost", returned_quantity AS "returnedQuantity"
       FROM sale_items WHERE sale_id = $1 ORDER BY product_name, variant_name`,
      [saleId]
    );
  }

  async payments(saleId: string, tx?: Tx): Promise<SalePaymentDTO[]> {
    return db(tx).query(
      `SELECT sp.id, sp.method, sp.account_id AS "accountId", a.name AS "accountName", sp.amount, sp.reference, sp.created_at AS "createdAt"
       FROM sale_payments sp JOIN accounts a ON a.id = sp.account_id WHERE sp.sale_id = $1 ORDER BY sp.created_at`,
      [saleId]
    );
  }

  async laterPayments(saleId: string): Promise<SaleDetailDTO["laterPayments"]> {
    return db().query(
      `SELECT p.id AS "paymentId", p.code, p.payment_date AS "paymentDate", p.method, a.amount
       FROM customer_payment_allocations a JOIN customer_payments p ON p.id = a.payment_id
       WHERE a.sale_id = $1 AND p.deleted_at IS NULL ORDER BY p.payment_date`,
      [saleId]
    );
  }

  async returns(saleId: string): Promise<SaleDetailDTO["returns"]> {
    return db().query(
      `SELECT id, code, return_date AS "returnDate", total_value AS "totalValue", refund_amount AS "refundAmount"
       FROM sale_returns WHERE sale_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [saleId]
    );
  }

  async create(data: Omit<Sale, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(SaleEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async insertItems(items: Array<Omit<SaleItem, "id">>, tx: Tx): Promise<void> {
    await tx.getRepository(SaleItemEntity).insert(items);
  }

  async insertPayment(payment: Omit<SalePayment, "id" | "createdAt">, tx: Tx): Promise<void> {
    await tx.getRepository(SalePaymentEntity).insert(payment);
  }

  async update(id: string, data: Partial<Sale>, tx: Tx): Promise<void> {
    await tx.getRepository(SaleEntity).update({ id }, data);
  }

  async lock(id: string, tx: Tx): Promise<void> {
    await tx.query(`SELECT id FROM sales WHERE id = $1 FOR UPDATE`, [id]);
  }

  async addReturnedQuantity(saleItemId: string, quantity: number, tx: Tx): Promise<void> {
    await tx.query(`UPDATE sale_items SET returned_quantity = returned_quantity + $2 WHERE id = $1`, [saleItemId, quantity]);
  }

  /** A customer's sales with a balance, locked, preferred first then oldest due. */
  async openForUpdate(customerId: string, preferredId: string | null, tx: Tx): Promise<OpenSaleRow[]> {
    return tx.query(
      `SELECT id, balance_due AS "balanceDue" FROM sales
       WHERE customer_id = $1 AND deleted_at IS NULL AND status = 'completed' AND balance_due > 0
       ORDER BY (id = $2::uuid) DESC, due_date NULLS LAST, sold_at
       FOR UPDATE`,
      [customerId, preferredId]
    );
  }

  /** Moves `delta` from balance_due into amount_paid (negative delta undoes a payment). */
  async applyPaid(saleId: string, delta: number, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE sales SET amount_paid = amount_paid + $2, balance_due = balance_due - $2,
              payment_status = CASE WHEN balance_due - $2 <= 0 THEN 'paid' WHEN amount_paid + $2 > 0 THEN 'part_paid' ELSE 'credit' END,
              updated_at = now()
       WHERE id = $1`,
      [saleId, delta]
    );
  }

  /** A return credited against what's still owed (not a payment, so amount_paid is untouched). */
  async reduceBalance(saleId: string, amount: number, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE sales SET balance_due = balance_due - $2,
              payment_status = CASE WHEN balance_due - $2 <= 0 THEN 'paid' ELSE payment_status END, updated_at = now()
       WHERE id = $1`,
      [saleId, amount]
    );
  }

  async customerOutstanding(customerId: string, tx?: Tx): Promise<number> {
    const rows: Array<{ total: number }> = await db(tx).query(
      `SELECT COALESCE((SELECT SUM(balance_due) FROM sales WHERE customer_id = $1 AND deleted_at IS NULL AND status = 'completed'), 0)
            - COALESCE((SELECT SUM(amount - allocated_amount) FROM customer_payments WHERE customer_id = $1 AND deleted_at IS NULL), 0) AS total`,
      [customerId]
    );
    return Number(rows[0]?.total ?? 0);
  }
}
