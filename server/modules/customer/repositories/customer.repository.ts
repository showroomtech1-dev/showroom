import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { num } from "../../../shared/utils/money";
import type { CustomerBalanceDTO, CustomerDTO, CustomerLedgerEntryDTO, CustomerListItemDTO, DebtorDTO } from "../dto/customer.dto";
import { CustomerEntity, type Customer } from "../entities/customer.entity";

const FIELDS = `c.id, c.code, c.name, c.phone, c.email, c.address, c.notes, c.credit_limit AS "creditLimit",
  c.is_active AS "isActive", c.created_at AS "createdAt"`;

/** `today` placeholder must be bound to the business's local date. */
const BALANCE_JOINS = (today: string) => `
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(s.total), 0) AS total, COUNT(*) AS count, COALESCE(SUM(s.balance_due), 0) AS outstanding,
           COALESCE(SUM(s.balance_due) FILTER (WHERE s.due_date < ${today}), 0) AS overdue, MAX(s.sold_at) AS last_at
    FROM sales s WHERE s.customer_id = c.id AND s.deleted_at IS NULL AND s.status = 'completed'
  ) sl ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(p.amount - p.allocated_amount), 0) AS credit
    FROM customer_payments p WHERE p.customer_id = c.id AND p.deleted_at IS NULL
  ) cr ON true`;

const BALANCE_FIELDS = `sl.total AS "totalPurchases", sl.count AS "purchaseCount", sl.outstanding, cr.credit,
  sl.outstanding - cr.credit AS balance, sl.overdue AS "overdueAmount", sl.last_at AS "lastPurchaseAt"`;

export interface CustomerListFilter {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  withDebt?: boolean;
  sort: "name" | "balance" | "recent";
}

const SORT: Record<CustomerListFilter["sort"], string> = {
  name: "x.name ASC",
  balance: "x.balance DESC, x.name ASC",
  recent: `x."lastPurchaseAt" DESC NULLS LAST`,
};

export class CustomerRepository {
  static Instance = new CustomerRepository();
  private constructor() {}

  async list(organizationId: string, f: CustomerListFilter, today: string): Promise<PagedRows<CustomerListItemDTO>> {
    const p = new SqlParams();
    const todayParam = p.add(today);
    const where = [`c.organization_id = ${p.add(organizationId)}`, "c.deleted_at IS NULL"];
    if (f.isActive !== undefined) where.push(`c.is_active = ${p.add(f.isActive)}`);
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(c.name ILIKE ${s} OR c.phone ILIKE ${s} OR c.code ILIKE ${s} OR c.email ILIKE ${s})`);
    }
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (
         SELECT ${FIELDS}, ${BALANCE_FIELDS} FROM customers c ${BALANCE_JOINS(`${todayParam}::date`)}
         WHERE ${where.join(" AND ")}
       ) x ${f.withDebt ? "WHERE x.balance > 0" : ""}
       ORDER BY ${SORT[f.sort]}
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<CustomerListItemDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<CustomerDTO | null> {
    const rows: CustomerDTO[] = await db(tx).query(
      `SELECT ${FIELDS} FROM customers c WHERE c.organization_id = $1 AND c.id = $2 AND c.deleted_at IS NULL`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async findByPhone(organizationId: string, phone: string, tx?: Tx): Promise<CustomerDTO | null> {
    const rows: CustomerDTO[] = await db(tx).query(
      `SELECT ${FIELDS} FROM customers c WHERE c.organization_id = $1 AND c.phone = $2 AND c.deleted_at IS NULL`,
      [organizationId, phone]
    );
    return rows[0] ?? null;
  }

  async balance(organizationId: string, id: string, today: string, tx?: Tx): Promise<CustomerBalanceDTO> {
    const rows: CustomerBalanceDTO[] = await db(tx).query(
      `SELECT ${BALANCE_FIELDS} FROM customers c ${BALANCE_JOINS("$3::date")} WHERE c.organization_id = $1 AND c.id = $2`,
      [organizationId, id, today]
    );
    const r = rows[0];
    return {
      totalPurchases: num(r?.totalPurchases),
      purchaseCount: num(r?.purchaseCount),
      outstanding: num(r?.outstanding),
      credit: num(r?.credit),
      balance: num(r?.balance),
      overdueAmount: num(r?.overdueAmount),
      lastPurchaseAt: r?.lastPurchaseAt ?? null,
    };
  }

  async create(data: Omit<Customer, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(CustomerEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<Customer>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(CustomerEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(CustomerEntity).softDelete({ id, organizationId });
  }

  /** Customer ledger between two local dates, with running balance (debit − credit). */
  async ledger(customerId: string, from: string, to: string, timezone: string): Promise<{ opening: number; entries: CustomerLedgerEntryDTO[] }> {
    const entriesSql = (tz: string) => `
      SELECT (s.sold_at AT TIME ZONE ${tz})::date AS date, 'sale' AS type, s.id, s.code AS reference,
             'Purchase (' || (SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id) || ' item(s))' AS description,
             s.total AS debit, 0::bigint AS credit, s.created_at AS "createdAt"
      FROM sales s WHERE s.customer_id = $1 AND s.deleted_at IS NULL AND s.status = 'completed'
      UNION ALL
      SELECT (s.sold_at AT TIME ZONE ${tz})::date, 'payment', sp.id, s.code, 'Paid at till (' || sp.method || ')',
             0::bigint, sp.amount, sp.created_at
      FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
      WHERE s.customer_id = $1 AND s.deleted_at IS NULL AND s.status = 'completed'
      UNION ALL
      SELECT p.payment_date, 'payment', p.id, p.code, 'Debt payment (' || p.method || ')' || COALESCE(' · ref ' || p.reference, ''),
             0::bigint, p.amount, p.created_at
      FROM customer_payments p WHERE p.customer_id = $1 AND p.deleted_at IS NULL
      UNION ALL
      SELECT r.return_date, 'return', r.id, r.code, 'Goods returned' || COALESCE(' · ' || r.reason, ''), 0::bigint, r.total_value, r.created_at
      FROM sale_returns r JOIN sales s ON s.id = r.sale_id
      WHERE s.customer_id = $1 AND r.deleted_at IS NULL AND s.status = 'completed'
      UNION ALL
      SELECT r.return_date, 'refund', r.id, r.code, 'Refund paid (' || COALESCE(r.refund_method, 'cash') || ')', r.refund_amount, 0::bigint, r.created_at
      FROM sale_returns r JOIN sales s ON s.id = r.sale_id
      WHERE s.customer_id = $1 AND r.deleted_at IS NULL AND r.refund_amount > 0 AND s.status = 'completed'`;
    const openingRows: Array<{ balance: number }> = await db().query(
      `SELECT COALESCE(SUM(debit - credit), 0) AS balance FROM (${entriesSql("$3")}) e WHERE e.date < $2`,
      [customerId, from, timezone]
    );
    const opening = num(openingRows[0]?.balance);
    const entries: CustomerLedgerEntryDTO[] = await db().query(
      `SELECT e.*, $5::bigint + SUM(e.debit - e.credit) OVER (ORDER BY e.date, e."createdAt", e.id) AS balance
       FROM (${entriesSql("$4")}) e WHERE e.date BETWEEN $2 AND $3
       ORDER BY e.date, e."createdAt", e.id LIMIT 5000`,
      [customerId, from, to, timezone, opening]
    );
    return { opening, entries };
  }

  /** Customers who owe money, with ageing by sale due date. */
  async debtors(organizationId: string, today: string, limit = 500): Promise<DebtorDTO[]> {
    return db().query(
      `SELECT x.* FROM (
         SELECT c.id AS "customerId", c.code, c.name, c.phone,
                COALESCE(SUM(s.balance_due), 0) - COALESCE(MAX(cr.credit), 0) AS balance,
                COALESCE(SUM(s.balance_due) FILTER (WHERE s.due_date IS NULL OR s.due_date >= $2), 0) AS current,
                COALESCE(SUM(s.balance_due) FILTER (WHERE $2::date - s.due_date BETWEEN 1 AND 30), 0) AS "days1to30",
                COALESCE(SUM(s.balance_due) FILTER (WHERE $2::date - s.due_date BETWEEN 31 AND 60), 0) AS "days31to60",
                COALESCE(SUM(s.balance_due) FILTER (WHERE $2::date - s.due_date BETWEEN 61 AND 90), 0) AS "days61to90",
                COALESCE(SUM(s.balance_due) FILTER (WHERE $2::date - s.due_date > 90), 0) AS "over90",
                MIN(s.due_date) AS "oldestDueDate"
         FROM customers c
         JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL AND s.status = 'completed' AND s.balance_due > 0
         LEFT JOIN LATERAL (
           SELECT SUM(p.amount - p.allocated_amount) AS credit FROM customer_payments p WHERE p.customer_id = c.id AND p.deleted_at IS NULL
         ) cr ON true
         WHERE c.organization_id = $1 AND c.deleted_at IS NULL
         GROUP BY c.id
       ) x WHERE x.balance > 0
       ORDER BY x.balance DESC LIMIT $3`,
      [organizationId, today, limit]
    );
  }

  /** Customers with sale balances due on or before `until` (overdue included). */
  async dueDebts(organizationId: string, today: string, until: string): Promise<Array<{ customerId: string; name: string; phone: string | null; amountDue: number; overdue: number; oldestDueDate: string }>> {
    return db().query(
      `SELECT c.id AS "customerId", c.name, c.phone, SUM(s.balance_due) AS "amountDue",
              COALESCE(SUM(s.balance_due) FILTER (WHERE s.due_date < $2), 0) AS overdue, MIN(s.due_date) AS "oldestDueDate"
       FROM sales s JOIN customers c ON c.id = s.customer_id
       WHERE s.organization_id = $1 AND s.deleted_at IS NULL AND s.status = 'completed' AND s.balance_due > 0
         AND s.due_date IS NOT NULL AND s.due_date <= $3 AND c.deleted_at IS NULL
       GROUP BY c.id ORDER BY MIN(s.due_date) LIMIT 500`,
      [organizationId, today, until]
    );
  }

  async receivableTotals(organizationId: string, today: string): Promise<{ outstanding: number; overdue: number; customers: number; credit: number }> {
    const rows: Array<Record<string, number>> = await db().query(
      `SELECT COALESCE(SUM(s.balance_due), 0) AS outstanding,
              COALESCE(SUM(s.balance_due) FILTER (WHERE s.due_date < $2), 0) AS overdue,
              COUNT(DISTINCT s.customer_id) AS customers,
              (SELECT COALESCE(SUM(p.amount - p.allocated_amount), 0) FROM customer_payments p
                WHERE p.organization_id = $1 AND p.deleted_at IS NULL) AS credit
       FROM sales s
       WHERE s.organization_id = $1 AND s.deleted_at IS NULL AND s.status = 'completed' AND s.balance_due > 0`,
      [organizationId, today]
    );
    return { outstanding: num(rows[0]?.outstanding), overdue: num(rows[0]?.overdue), customers: num(rows[0]?.customers), credit: num(rows[0]?.credit) };
  }

  async purchaseHistory(customerId: string, page: number, limit: number) {
    const rows = await db().query(
      `SELECT s.id, s.code, s.sold_at AS "soldAt", s.total, s.amount_paid AS "amountPaid", s.balance_due AS "balanceDue",
              s.payment_status AS "paymentStatus", s.status, s.returned_amount AS "returnedAmount",
              (SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id)::int AS "itemCount",
              COUNT(*) OVER() AS "__total"
       FROM sales s WHERE s.customer_id = $1 AND s.deleted_at IS NULL
       ORDER BY s.sold_at DESC LIMIT $2 OFFSET $3`,
      [customerId, limit, getOffset(page, limit)]
    );
    return fromWindowedRows<Record<string, unknown>>(rows, page, limit);
  }

  async hasSales(customerId: string): Promise<boolean> {
    const rows: Array<{ exists: boolean }> = await db().query(
      `SELECT EXISTS (SELECT 1 FROM sales WHERE customer_id = $1 AND deleted_at IS NULL) AS exists`,
      [customerId]
    );
    return Boolean(rows[0]?.exists);
  }
}
