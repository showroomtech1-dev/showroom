// Aggregates over sales for the daily summary, commissions and the dashboard.
// Every query takes local-date bounds plus the business timezone.
import { SqlParams, tzDateBetween } from "../../../infrastructure/database/sql";
import { db } from "../../../infrastructure/database/transaction";
import { num } from "../../../shared/utils/money";

export interface Scope {
  organizationId: string;
  branchId: string | null;
  from: string;
  to: string;
  timezone: string;
  soldById?: string | null;
}

function scoped(p: SqlParams, s: Scope, alias = "s"): string[] {
  const where = [`${alias}.organization_id = ${p.add(s.organizationId)}`, `${alias}.deleted_at IS NULL`, `${alias}.status = 'completed'`];
  if (s.branchId) where.push(`${alias}.branch_id = ${p.add(s.branchId)}`);
  if (s.soldById) where.push(`${alias}.sold_by_id = ${p.add(s.soldById)}`);
  where.push(tzDateBetween(`${alias}.sold_at`, p.add(s.from), p.add(s.to), p.add(s.timezone)));
  return where;
}

export class SaleReportRepository {
  static Instance = new SaleReportRepository();
  private constructor() {}

  async totals(s: Scope) {
    const p = new SqlParams();
    const rows: Array<Record<string, number>> = await db().query(
      `SELECT COUNT(*) AS "salesCount",
              COALESCE(SUM(s.subtotal + (SELECT COALESCE(SUM(i.discount), 0) FROM sale_items i WHERE i.sale_id = s.id)), 0) AS "grossSales",
              COALESCE(SUM(s.discount_total + (SELECT COALESCE(SUM(i.discount), 0) FROM sale_items i WHERE i.sale_id = s.id)), 0) AS discounts,
              COALESCE(SUM(s.tax_amount), 0) AS tax,
              COALESCE(SUM(s.total), 0) AS "totalSales",
              COALESCE(SUM(s.total - s.tax_amount), 0) AS "netSales",
              COALESCE(SUM(s.cost_total), 0) AS "costOfGoods",
              COALESCE(SUM(s.commission_amount), 0) AS commission,
              COALESCE(SUM(s.total - (SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp WHERE sp.sale_id = s.id)), 0) AS "soldOnCredit",
              COALESCE(SUM(s.balance_due), 0) AS "stillOutstanding"
       FROM sales s WHERE ${scoped(p, s).join(" AND ")}`,
      p.values
    );
    const r = rows[0] ?? {};
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, num(v)])) as Record<
      "salesCount" | "grossSales" | "discounts" | "tax" | "totalSales" | "netSales" | "costOfGoods" | "commission" | "soldOnCredit" | "stillOutstanding",
      number
    >;
  }

  async returnsTotals(s: Omit<Scope, "soldById">) {
    const rows: Array<Record<string, number>> = await db().query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(r.total_value), 0) AS value, COALESCE(SUM(r.tax_reversed), 0) AS tax,
              COALESCE(SUM(r.cost_reversed), 0) AS cost, COALESCE(SUM(r.refund_amount), 0) AS refunds
       FROM sale_returns r JOIN sales s ON s.id = r.sale_id
       WHERE r.organization_id = $1 AND r.deleted_at IS NULL AND ($2::uuid IS NULL OR r.branch_id = $2) AND r.return_date BETWEEN $3 AND $4`,
      [s.organizationId, s.branchId, s.from, s.to]
    );
    const r = rows[0] ?? {};
    return { count: num(r.count), value: num(r.value), tax: num(r.tax), cost: num(r.cost), refunds: num(r.refunds) };
  }

  /** Money received per method: till payments on sales in range + debt payments dated in range. */
  async receiptsByMethod(s: Omit<Scope, "soldById">): Promise<Array<{ method: string; tillPayments: number; debtPayments: number; total: number }>> {
    const p = new SqlParams();
    const salesWhere = scoped(p, { ...s, soldById: null });
    const org = p.add(s.organizationId);
    const branch = p.add(s.branchId);
    const from = p.add(s.from);
    const to = p.add(s.to);
    const rows: Array<{ method: string; tillPayments: number; debtPayments: number }> = await db().query(
      `SELECT method, SUM(till) AS "tillPayments", SUM(debt) AS "debtPayments" FROM (
         SELECT sp.method, sp.amount AS till, 0 AS debt FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
         WHERE ${salesWhere.join(" AND ")}
         UNION ALL
         SELECT cp.method, 0, cp.amount FROM customer_payments cp
         WHERE cp.organization_id = ${org} AND cp.deleted_at IS NULL AND (${branch}::uuid IS NULL OR cp.branch_id = ${branch}::uuid)
           AND cp.payment_date BETWEEN ${from} AND ${to}
       ) m GROUP BY method ORDER BY method`,
      p.values
    );
    return rows.map((r) => ({ method: r.method, tillPayments: num(r.tillPayments), debtPayments: num(r.debtPayments), total: num(r.tillPayments) + num(r.debtPayments) }));
  }

  async topItems(s: Scope, limit = 10) {
    const p = new SqlParams();
    const where = scoped(p, s);
    const rows: Array<{ variantId: string; productId: string; productName: string; variantName: string | null; quantity: number; revenue: number; cost: number }> =
      await db().query(
        `SELECT i.variant_id AS "variantId", i.product_id AS "productId", i.product_name AS "productName", i.variant_name AS "variantName",
                SUM(i.quantity - i.returned_quantity) AS quantity,
                SUM(i.line_total * (i.quantity - i.returned_quantity) / i.quantity) AS revenue,
                SUM(i.unit_cost * (i.quantity - i.returned_quantity)) AS cost
         FROM sale_items i JOIN sales s ON s.id = i.sale_id
         WHERE ${where.join(" AND ")}
         GROUP BY i.variant_id, i.product_id, i.product_name, i.variant_name
         HAVING SUM(i.quantity - i.returned_quantity) > 0
         ORDER BY quantity DESC, revenue DESC
         LIMIT ${p.add(limit)}`,
        p.values
      );
    return rows.map((r) => ({ ...r, quantity: num(r.quantity), revenue: num(r.revenue), cost: num(r.cost) }));
  }

  async bySeller(s: Scope) {
    const p = new SqlParams();
    const where = scoped(p, s);
    const rows: Array<{ soldById: string; soldByName: string; salesCount: number; totalSales: number; netSales: number; returned: number; commission: number }> =
      await db().query(
        `SELECT s.sold_by_id AS "soldById", u.name AS "soldByName", COUNT(*) AS "salesCount", SUM(s.total) AS "totalSales",
                SUM(s.total - s.tax_amount) AS "netSales", SUM(s.returned_amount) AS returned, SUM(s.commission_amount) AS commission
         FROM sales s JOIN users u ON u.id = s.sold_by_id
         WHERE ${where.join(" AND ")}
         GROUP BY s.sold_by_id, u.name ORDER BY "totalSales" DESC`,
        p.values
      );
    return rows.map((r) => ({ ...r, salesCount: num(r.salesCount), totalSales: num(r.totalSales), netSales: num(r.netSales), returned: num(r.returned), commission: num(r.commission) }));
  }

  /** Daily totals for trend charts. */
  async dailySeries(s: Omit<Scope, "soldById">): Promise<Array<{ date: string; total: number; net: number; cost: number; count: number }>> {
    const p = new SqlParams();
    const where = scoped(p, { ...s, soldById: null });
    const tz = p.add(s.timezone);
    const rows: Array<{ date: string; total: number; net: number; cost: number; count: number }> = await db().query(
      `SELECT (s.sold_at AT TIME ZONE ${tz})::date AS date, SUM(s.total) AS total, SUM(s.total - s.tax_amount) AS net,
              SUM(s.cost_total) AS cost, COUNT(*) AS count
       FROM sales s WHERE ${where.join(" AND ")}
       GROUP BY 1 ORDER BY 1`,
      p.values
    );
    return rows.map((r) => ({ date: r.date, total: num(r.total), net: num(r.net), cost: num(r.cost), count: num(r.count) }));
  }

  /** Expenses paid on these dates, by method (cash expenses leave the drawer). */
  async expensesByMethod(s: Omit<Scope, "soldById">): Promise<Array<{ method: string; total: number }>> {
    const rows: Array<{ method: string; total: number }> = await db().query(
      `SELECT method, SUM(amount) AS total FROM expenses
       WHERE organization_id = $1 AND deleted_at IS NULL AND ($2::uuid IS NULL OR branch_id = $2) AND expense_date BETWEEN $3 AND $4
       GROUP BY method ORDER BY method`,
      [s.organizationId, s.branchId, s.from, s.to]
    );
    return rows.map((r) => ({ method: r.method, total: num(r.total) }));
  }
}
