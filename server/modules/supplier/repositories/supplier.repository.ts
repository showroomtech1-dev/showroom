import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { num } from "../../../shared/utils/money";
import type { DueSupplyDTO, SupplierBalanceDTO, SupplierDTO, SupplierLedgerEntryDTO, SupplierListItemDTO } from "../dto/supplier.dto";
import { SupplierEntity, type Supplier } from "../entities/supplier.entity";
import type { ListSuppliersQuery } from "../validators/supplier.schema";

const FIELDS = `s.id, s.code, s.type, s.name, s.contact_person AS "contactPerson", s.phone, s.email, s.address, s.category,
  s.bank_name AS "bankName", s.bank_account_number AS "bankAccountNumber", s.bank_account_name AS "bankAccountName",
  s.payment_terms_days AS "paymentTermsDays", s.notes, s.is_active AS "isActive", s.created_at AS "createdAt"`;

/** Per-supplier totals. `$today` must be bound to the business's local date. */
const BALANCES = (today: string) => `
  COALESCE(sup.total, 0) AS "totalSupplied",
  COALESCE(pay.total, 0) AS "totalPaid",
  COALESCE(sup.total, 0) - COALESCE(pay.total, 0) AS balance,
  COALESCE(sup.overdue, 0) AS "overdueAmount",
  sup.last_date AS "lastSupplyDate"
  FROM suppliers s
  LEFT JOIN LATERAL (
    SELECT SUM(x.total_cost) AS total, MAX(x.supply_date) AS last_date,
           SUM(x.total_cost - x.amount_paid) FILTER (WHERE x.due_date < ${today} AND x.amount_paid < x.total_cost) AS overdue
    FROM supplies x WHERE x.supplier_id = s.id AND x.deleted_at IS NULL
  ) sup ON true
  LEFT JOIN LATERAL (
    SELECT SUM(y.amount) AS total FROM supplier_payments y WHERE y.supplier_id = s.id AND y.deleted_at IS NULL
  ) pay ON true`;

const SORT: Record<ListSuppliersQuery["sort"], string> = {
  name: "x.name ASC",
  balance: "x.balance DESC, x.name ASC",
  recent: `x."lastSupplyDate" DESC NULLS LAST, x.name ASC`,
};

export class SupplierRepository {
  static Instance = new SupplierRepository();
  private constructor() {}

  async list(organizationId: string, f: ListSuppliersQuery, today: string): Promise<PagedRows<SupplierListItemDTO>> {
    const p = new SqlParams();
    const todayParam = p.add(today);
    const where = [`s.organization_id = ${p.add(organizationId)}`, "s.deleted_at IS NULL"];
    if (f.type) where.push(`s.type = ${p.add(f.type)}`);
    if (f.category) where.push(`s.category = ${p.add(f.category)}`);
    if (f.isActive !== undefined) where.push(`s.is_active = ${p.add(f.isActive)}`);
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(s.name ILIKE ${s} OR s.contact_person ILIKE ${s} OR s.phone ILIKE ${s} OR s.code ILIKE ${s} OR s.category ILIKE ${s})`);
    }
    const balanceFilter = f.withBalance ? "WHERE x.balance > 0" : "";
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (
         SELECT ${FIELDS}, ${BALANCES(`${todayParam}::date`)}
         WHERE ${where.join(" AND ")}
       ) x ${balanceFilter}
       ORDER BY ${SORT[f.sort]}
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<SupplierListItemDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<SupplierDTO | null> {
    const rows: SupplierDTO[] = await db(tx).query(
      `SELECT ${FIELDS} FROM suppliers s WHERE s.organization_id = $1 AND s.id = $2 AND s.deleted_at IS NULL`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async balance(organizationId: string, id: string, today: string, tx?: Tx): Promise<SupplierBalanceDTO> {
    const rows: SupplierBalanceDTO[] = await db(tx).query(
      `SELECT ${BALANCES("$3::date")} WHERE s.organization_id = $1 AND s.id = $2`,
      [organizationId, id, today]
    );
    const r = rows[0];
    return {
      totalSupplied: num(r?.totalSupplied),
      totalPaid: num(r?.totalPaid),
      balance: num(r?.balance),
      overdueAmount: num(r?.overdueAmount),
      lastSupplyDate: r?.lastSupplyDate ?? null,
    };
  }

  async create(data: Omit<Supplier, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(SupplierEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<Supplier>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(SupplierEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(SupplierEntity).softDelete({ id, organizationId });
  }

  async hasActivity(id: string): Promise<boolean> {
    const rows: Array<{ used: boolean }> = await db().query(
      `SELECT (EXISTS (SELECT 1 FROM supplies WHERE supplier_id = $1 AND deleted_at IS NULL)
            OR EXISTS (SELECT 1 FROM supplier_payments WHERE supplier_id = $1 AND deleted_at IS NULL)) AS used`,
      [id]
    );
    return Boolean(rows[0]?.used);
  }

  /** Σ supplied − Σ paid strictly before `date`. */
  async balanceBefore(supplierId: string, date: string): Promise<number> {
    const rows: Array<{ balance: number }> = await db().query(
      `SELECT COALESCE((SELECT SUM(total_cost) FROM supplies WHERE supplier_id = $1 AND deleted_at IS NULL AND supply_date < $2), 0)
            - COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = $1 AND deleted_at IS NULL AND payment_date < $2), 0) AS balance`,
      [supplierId, date]
    );
    return num(rows[0]?.balance);
  }

  async ledger(supplierId: string, from: string, to: string, opening: number): Promise<SupplierLedgerEntryDTO[]> {
    return db().query(
      `SELECT e.*, $4::bigint + SUM(e.supplied - e.paid) OVER (ORDER BY e.date, e."createdAt", e.id) AS balance
       FROM (
         SELECT s.supply_date AS date, 'supply' AS type, s.id, s.code AS reference,
                CASE WHEN s.invoice_number IS NOT NULL THEN 'Invoice ' || s.invoice_number ELSE 'Goods / services received' END AS description,
                s.total_cost AS supplied, 0::bigint AS paid, s.created_at AS "createdAt"
         FROM supplies s WHERE s.supplier_id = $1 AND s.deleted_at IS NULL AND s.supply_date BETWEEN $2 AND $3
         UNION ALL
         SELECT p.payment_date, 'payment', p.id, p.code,
                'Payment (' || p.method || ')' || COALESCE(' · ref ' || p.reference, '') ||
                  CASE WHEN p.is_overpayment THEN ' · OVERPAYMENT' ELSE '' END,
                0::bigint, p.amount, p.created_at
         FROM supplier_payments p WHERE p.supplier_id = $1 AND p.deleted_at IS NULL AND p.payment_date BETWEEN $2 AND $3
       ) e
       ORDER BY e.date, e."createdAt", e.id
       LIMIT 5000`,
      [supplierId, from, to, opening]
    );
  }

  async payableTotals(organizationId: string, today: string, dueSoonUntil: string, type?: string) {
    const rows: Array<Record<string, number>> = await db().query(
      `SELECT COALESCE(SUM(GREATEST(b.balance, 0)), 0) AS "totalOutstanding",
              COALESCE(SUM(LEAST(b.balance, 0)), 0) AS "creditBalances"
       FROM (
         SELECT COALESCE((SELECT SUM(total_cost) FROM supplies x WHERE x.supplier_id = s.id AND x.deleted_at IS NULL), 0)
              - COALESCE((SELECT SUM(amount) FROM supplier_payments y WHERE y.supplier_id = s.id AND y.deleted_at IS NULL), 0) AS balance
         FROM suppliers s WHERE s.organization_id = $1 AND s.deleted_at IS NULL AND ($2::text IS NULL OR s.type = $2)
       ) b`,
      [organizationId, type ?? null]
    );
    const due: Array<Record<string, number>> = await db().query(
      `SELECT COALESCE(SUM(x.total_cost - x.amount_paid) FILTER (WHERE x.due_date < $2), 0) AS "overdueAmount",
              COUNT(*) FILTER (WHERE x.due_date < $2) AS "overdueCount",
              COALESCE(SUM(x.total_cost - x.amount_paid) FILTER (WHERE x.due_date BETWEEN $2 AND $3), 0) AS "dueSoonAmount",
              COUNT(*) FILTER (WHERE x.due_date BETWEEN $2 AND $3) AS "dueSoonCount"
       FROM supplies x JOIN suppliers s ON s.id = x.supplier_id
       WHERE x.organization_id = $1 AND x.deleted_at IS NULL AND x.amount_paid < x.total_cost
         AND ($4::text IS NULL OR s.type = $4)`,
      [organizationId, today, dueSoonUntil, type ?? null]
    );
    return {
      totalOutstanding: num(rows[0]?.totalOutstanding),
      creditBalances: num(rows[0]?.creditBalances),
      overdueAmount: num(due[0]?.overdueAmount),
      overdueCount: num(due[0]?.overdueCount),
      dueSoonAmount: num(due[0]?.dueSoonAmount),
      dueSoonCount: num(due[0]?.dueSoonCount),
    };
  }

  async topSuppliers(organizationId: string, since: string, limit: number, type?: string) {
    return db().query(
      `SELECT s.id AS "supplierId", s.name, s.type,
              COALESCE(SUM(x.total_cost) FILTER (WHERE x.supply_date >= $2), 0) AS supplied,
              COALESCE(SUM(x.total_cost), 0) - COALESCE((SELECT SUM(amount) FROM supplier_payments y WHERE y.supplier_id = s.id AND y.deleted_at IS NULL), 0) AS balance
       FROM suppliers s
       LEFT JOIN supplies x ON x.supplier_id = s.id AND x.deleted_at IS NULL
       WHERE s.organization_id = $1 AND s.deleted_at IS NULL AND ($4::text IS NULL OR s.type = $4)
       GROUP BY s.id
       HAVING COALESCE(SUM(x.total_cost) FILTER (WHERE x.supply_date >= $2), 0) > 0
       ORDER BY supplied DESC
       LIMIT $3`,
      [organizationId, since, limit, type ?? null]
    );
  }

  /** Unpaid supplies due on or before `until` (overdue ones included), oldest due first. */
  async dueSupplies(organizationId: string, today: string, until: string, limit = 50): Promise<DueSupplyDTO[]> {
    return db().query(
      `SELECT x.id AS "supplyId", x.code, x.supplier_id AS "supplierId", s.name AS "supplierName", x.invoice_number AS "invoiceNumber",
              x.supply_date AS "supplyDate", x.due_date AS "dueDate", x.total_cost AS "totalCost", x.amount_paid AS "amountPaid",
              x.total_cost - x.amount_paid AS outstanding, GREATEST($2::date - x.due_date, 0) AS "daysOverdue"
       FROM supplies x JOIN suppliers s ON s.id = x.supplier_id
       WHERE x.organization_id = $1 AND x.deleted_at IS NULL AND x.amount_paid < x.total_cost
         AND x.due_date IS NOT NULL AND x.due_date <= $3
       ORDER BY x.due_date, x.created_at
       LIMIT $4`,
      [organizationId, today, until, limit]
    );
  }
}
