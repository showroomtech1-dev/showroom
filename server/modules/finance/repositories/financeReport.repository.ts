// Cross-module aggregates for the profit & loss and cash-flow statements.
// Revenue and VAT come from sales/returns; COGS from cost snapshots; expenses from expenses,
// vendor service bills and approved payroll.
import { db } from "../../../infrastructure/database/transaction";
import { num } from "../../../shared/utils/money";

export interface PeriodScope {
  organizationId: string;
  branchId: string | null;
  from: string;
  to: string;
  timezone: string;
}

export class FinanceReportRepository {
  static Instance = new FinanceReportRepository();
  private constructor() {}

  async salesFigures(s: PeriodScope) {
    const rows: Array<Record<string, number>> = await db().query(
      `SELECT COALESCE(SUM(total), 0) AS gross, COALESCE(SUM(tax_amount), 0) AS tax, COALESCE(SUM(cost_total), 0) AS cost,
              COALESCE(SUM(discount_total), 0) AS discounts, COUNT(*) AS count
       FROM sales
       WHERE organization_id = $1 AND deleted_at IS NULL AND status = 'completed' AND ($2::uuid IS NULL OR branch_id = $2)
         AND sold_at >= ($3::date::timestamp AT TIME ZONE $5) AND sold_at < (($4::date + 1)::timestamp AT TIME ZONE $5)`,
      [s.organizationId, s.branchId, s.from, s.to, s.timezone]
    );
    const returns: Array<Record<string, number>> = await db().query(
      `SELECT COALESCE(SUM(total_value), 0) AS value, COALESCE(SUM(tax_reversed), 0) AS tax, COALESCE(SUM(cost_reversed), 0) AS cost
       FROM sale_returns WHERE organization_id = $1 AND deleted_at IS NULL AND ($2::uuid IS NULL OR branch_id = $2) AND return_date BETWEEN $3 AND $4`,
      [s.organizationId, s.branchId, s.from, s.to]
    );
    const r = rows[0] ?? {};
    const ret = returns[0] ?? {};
    return {
      grossSales: num(r.gross),
      salesTax: num(r.tax),
      cost: num(r.cost),
      discounts: num(r.discounts),
      count: num(r.count),
      returnsValue: num(ret.value),
      returnsTax: num(ret.tax),
      returnsCost: num(ret.cost),
    };
  }

  async expensesByCategory(s: PeriodScope): Promise<Array<{ category: string; amount: number }>> {
    const rows: Array<{ category: string; amount: number }> = await db().query(
      `SELECT c.name AS category, SUM(e.amount) AS amount
       FROM expenses e JOIN expense_categories c ON c.id = e.category_id
       WHERE e.organization_id = $1 AND e.deleted_at IS NULL AND ($2::uuid IS NULL OR e.branch_id = $2) AND e.expense_date BETWEEN $3 AND $4
       GROUP BY c.name ORDER BY amount DESC`,
      [s.organizationId, s.branchId, s.from, s.to]
    );
    return rows.map((r) => ({ category: r.category, amount: num(r.amount) }));
  }

  /** Service lines on vendor bills (supply lines with no product) are operating expenses, not stock. */
  async vendorBills(s: PeriodScope): Promise<number> {
    const rows: Array<{ total: number }> = await db().query(
      `SELECT COALESCE(SUM(i.total_cost), 0) AS total
       FROM supply_items i JOIN supplies x ON x.id = i.supply_id
       WHERE x.organization_id = $1 AND x.deleted_at IS NULL AND i.variant_id IS NULL AND ($2::uuid IS NULL OR x.branch_id = $2)
         AND x.supply_date BETWEEN $3 AND $4`,
      [s.organizationId, s.branchId, s.from, s.to]
    );
    return num(rows[0]?.total);
  }

  /** Gross pay of approved / paid payroll whose pay date falls in the period. */
  async payroll(s: PeriodScope): Promise<number> {
    const rows: Array<{ total: number }> = await db().query(
      `SELECT COALESCE(SUM(total_gross), 0) AS total FROM payroll_runs
       WHERE organization_id = $1 AND deleted_at IS NULL AND status IN ('approved', 'paid') AND ($2::uuid IS NULL OR branch_id IS NULL OR branch_id = $2)
         AND pay_date BETWEEN $3 AND $4`,
      [s.organizationId, s.branchId, s.from, s.to]
    );
    return num(rows[0]?.total);
  }

  /** Money in / out per ledger type over the period (transfers between own accounts excluded). */
  async cashMovements(s: Omit<PeriodScope, "timezone">): Promise<Array<{ type: string; direction: string; amount: number }>> {
    const rows: Array<{ type: string; direction: string; amount: number }> = await db().query(
      `SELECT type, direction, SUM(amount) AS amount FROM account_transactions
       WHERE organization_id = $1 AND ($2::uuid IS NULL OR branch_id = $2) AND transaction_date BETWEEN $3 AND $4
         AND type NOT IN ('transfer_in', 'transfer_out')
       GROUP BY type, direction ORDER BY type`,
      [s.organizationId, s.branchId, s.from, s.to]
    );
    return rows.map((r) => ({ ...r, amount: num(r.amount) }));
  }

  /** Total of all account balances at the end of `date`. */
  async totalBalanceAt(organizationId: string, date: string): Promise<number> {
    const rows: Array<{ total: number }> = await db().query(
      `SELECT COALESCE(SUM(a.opening_balance), 0) + COALESCE((
         SELECT SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END)
         FROM account_transactions t WHERE t.organization_id = $1 AND t.transaction_date <= $2
       ), 0) AS total
       FROM accounts a WHERE a.organization_id = $1 AND a.deleted_at IS NULL`,
      [organizationId, date]
    );
    return num(rows[0]?.total);
  }

  /** Monthly revenue / COGS / expenses for the profit chart. */
  async monthlyProfit(organizationId: string, branchId: string | null, from: string, to: string, timezone: string) {
    const rows: Array<{ month: string; revenue: number; cogs: number; expenses: number; payroll: number }> = await db().query(
      `WITH months AS (
         SELECT to_char(m, 'YYYY-MM') AS month FROM generate_series(date_trunc('month', $3::date), date_trunc('month', $4::date), interval '1 month') m
       ),
       s AS (
         SELECT to_char((sold_at AT TIME ZONE $5)::date, 'YYYY-MM') AS month, SUM(total - tax_amount) AS revenue, SUM(cost_total) AS cogs
         FROM sales WHERE organization_id = $1 AND deleted_at IS NULL AND status = 'completed' AND ($2::uuid IS NULL OR branch_id = $2)
           AND sold_at >= ($3::date::timestamp AT TIME ZONE $5) AND sold_at < (($4::date + 1)::timestamp AT TIME ZONE $5)
         GROUP BY 1
       ),
       r AS (
         SELECT to_char(return_date, 'YYYY-MM') AS month, SUM(total_value - tax_reversed) AS revenue, SUM(cost_reversed) AS cogs
         FROM sale_returns WHERE organization_id = $1 AND deleted_at IS NULL AND ($2::uuid IS NULL OR branch_id = $2) AND return_date BETWEEN $3 AND $4
         GROUP BY 1
       ),
       e AS (
         SELECT to_char(expense_date, 'YYYY-MM') AS month, SUM(amount) AS expenses
         FROM expenses WHERE organization_id = $1 AND deleted_at IS NULL AND ($2::uuid IS NULL OR branch_id = $2) AND expense_date BETWEEN $3 AND $4
         GROUP BY 1
       ),
       p AS (
         SELECT to_char(pay_date, 'YYYY-MM') AS month, SUM(total_gross) AS payroll
         FROM payroll_runs WHERE organization_id = $1 AND deleted_at IS NULL AND status IN ('approved', 'paid') AND pay_date BETWEEN $3 AND $4
         GROUP BY 1
       )
       SELECT months.month, COALESCE(s.revenue, 0) - COALESCE(r.revenue, 0) AS revenue, COALESCE(s.cogs, 0) - COALESCE(r.cogs, 0) AS cogs,
              COALESCE(e.expenses, 0) AS expenses, COALESCE(p.payroll, 0) AS payroll
       FROM months LEFT JOIN s USING (month) LEFT JOIN r USING (month) LEFT JOIN e USING (month) LEFT JOIN p USING (month)
       ORDER BY months.month`,
      [organizationId, branchId, from, to, timezone]
    );
    return rows.map((row) => {
      const revenue = num(row.revenue);
      const cogs = num(row.cogs);
      const expenses = num(row.expenses);
      const payroll = num(row.payroll);
      return { month: row.month, revenue, cogs, grossProfit: revenue - cogs, expenses, payroll, netProfit: revenue - cogs - expenses - payroll };
    });
  }
}
