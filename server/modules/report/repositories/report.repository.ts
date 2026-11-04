// Row-level datasets for exports (capped at 10 000 rows each).
import { SqlParams, tzDateBetween } from "../../../infrastructure/database/sql";
import { db } from "../../../infrastructure/database/transaction";

export interface ReportFilter {
  organizationId: string;
  branchId: string | null;
  from: string;
  to: string;
  timezone: string;
  staffId?: string;
  productId?: string;
  customerId?: string;
  supplierId?: string;
  categoryId?: string;
}

const ROW_CAP = 10_000;

export class ReportRepository {
  static Instance = new ReportRepository();
  private constructor() {}

  private salesWhere(p: SqlParams, f: ReportFilter): string[] {
    const where = [`s.organization_id = ${p.add(f.organizationId)}`, "s.deleted_at IS NULL", "s.status = 'completed'"];
    where.push(tzDateBetween("s.sold_at", p.add(f.from), p.add(f.to), p.add(f.timezone)));
    if (f.branchId) where.push(`s.branch_id = ${p.add(f.branchId)}`);
    if (f.staffId) where.push(`s.sold_by_id = ${p.add(f.staffId)}`);
    if (f.customerId) where.push(`s.customer_id = ${p.add(f.customerId)}`);
    if (f.productId) where.push(`EXISTS (SELECT 1 FROM sale_items fi WHERE fi.sale_id = s.id AND fi.product_id = ${p.add(f.productId)})`);
    return where;
  }

  async sales(f: ReportFilter): Promise<Array<Record<string, unknown>>> {
    const p = new SqlParams();
    const where = this.salesWhere(p, f);
    return db().query(
      `SELECT s.code, s.sold_at AS "soldAt", b.name AS branch, u.name AS "soldBy", COALESCE(c.name, 'Walk-in') AS customer,
              (SELECT SUM(i.quantity) FROM sale_items i WHERE i.sale_id = s.id) AS items,
              s.subtotal, s.discount_total AS discount, s.tax_amount AS tax, s.total, s.amount_paid AS paid,
              s.balance_due AS balance, s.returned_amount AS returned, s.cost_total AS cost,
              s.total - s.tax_amount - s.cost_total AS profit, s.payment_status AS status
       FROM sales s JOIN branches b ON b.id = s.branch_id JOIN users u ON u.id = s.sold_by_id LEFT JOIN customers c ON c.id = s.customer_id
       WHERE ${where.join(" AND ")} ORDER BY s.sold_at LIMIT ${ROW_CAP}`,
      p.values
    );
  }

  async salesByProduct(f: ReportFilter): Promise<Array<Record<string, unknown>>> {
    const p = new SqlParams();
    const where = this.salesWhere(p, f);
    if (f.categoryId) where.push(`pr.category_id = ${p.add(f.categoryId)}`);
    return db().query(
      `SELECT i.product_name AS product, COALESCE(i.variant_name, '') AS variant, i.sku, c.name AS category,
              SUM(i.quantity - i.returned_quantity) AS quantity,
              SUM(i.line_total * (i.quantity - i.returned_quantity) / i.quantity) AS revenue,
              SUM(i.unit_cost * (i.quantity - i.returned_quantity)) AS cost,
              SUM(i.line_total * (i.quantity - i.returned_quantity) / i.quantity) - SUM(i.unit_cost * (i.quantity - i.returned_quantity)) AS profit
       FROM sale_items i JOIN sales s ON s.id = i.sale_id JOIN products pr ON pr.id = i.product_id
       LEFT JOIN product_categories c ON c.id = pr.category_id
       WHERE ${where.join(" AND ")}
       GROUP BY i.product_name, i.variant_name, i.sku, c.name
       HAVING SUM(i.quantity - i.returned_quantity) > 0
       ORDER BY revenue DESC LIMIT ${ROW_CAP}`,
      p.values
    );
  }

  async inventory(f: Pick<ReportFilter, "organizationId" | "branchId" | "categoryId" | "supplierId">): Promise<Array<Record<string, unknown>>> {
    const p = new SqlParams();
    const org = p.add(f.organizationId);
    const branchJoin = f.branchId ? `AND sl.branch_id = ${p.add(f.branchId)}` : "";
    const where = [`v.organization_id = ${org}`, "v.deleted_at IS NULL", "pr.deleted_at IS NULL"];
    if (f.categoryId) where.push(`pr.category_id = ${p.add(f.categoryId)}`);
    if (f.supplierId) where.push(`pr.supplier_id = ${p.add(f.supplierId)}`);
    return db().query(
      `SELECT pr.name AS product, CASE WHEN v.name = 'Default' THEN '' ELSE v.name END AS variant, v.sku, c.name AS category, pr.brand,
              COALESCE(SUM(sl.quantity), 0) AS quantity, COALESCE(v.reorder_level, pr.reorder_level) AS "reorderLevel",
              v.cost_price AS "costPrice", v.selling_price AS "sellingPrice",
              COALESCE(SUM(sl.quantity), 0) * v.cost_price AS "valueAtCost", COALESCE(SUM(sl.quantity), 0) * v.selling_price AS "valueAtSelling",
              CASE WHEN COALESCE(SUM(sl.quantity), 0) <= 0 THEN 'Out of stock'
                   WHEN COALESCE(SUM(sl.quantity), 0) <= COALESCE(v.reorder_level, pr.reorder_level) THEN 'Low' ELSE 'OK' END AS status
       FROM product_variants v JOIN products pr ON pr.id = v.product_id
       LEFT JOIN product_categories c ON c.id = pr.category_id
       LEFT JOIN stock_levels sl ON sl.variant_id = v.id ${branchJoin}
       WHERE ${where.join(" AND ")}
       GROUP BY v.id, pr.id, c.name ORDER BY pr.name, v.name LIMIT ${ROW_CAP}`,
      p.values
    );
  }

  async expenses(f: ReportFilter): Promise<Array<Record<string, unknown>>> {
    return db().query(
      `SELECT e.code, e.expense_date AS date, c.name AS category, COALESCE(s.name, e.payee) AS payee, e.description, e.method,
              a.name AS account, b.name AS branch, e.amount
       FROM expenses e JOIN expense_categories c ON c.id = e.category_id JOIN accounts a ON a.id = e.account_id
       JOIN branches b ON b.id = e.branch_id LEFT JOIN suppliers s ON s.id = e.supplier_id
       WHERE e.organization_id = $1 AND e.deleted_at IS NULL AND e.expense_date BETWEEN $2 AND $3
         AND ($4::uuid IS NULL OR e.branch_id = $4) AND ($5::uuid IS NULL OR e.category_id = $5) AND ($6::uuid IS NULL OR e.supplier_id = $6)
       ORDER BY e.expense_date, e.created_at LIMIT ${ROW_CAP}`,
      [f.organizationId, f.from, f.to, f.branchId, f.categoryId ?? null, f.supplierId ?? null]
    );
  }

  async payroll(f: ReportFilter): Promise<Array<Record<string, unknown>>> {
    return db().query(
      `SELECT r.code AS run, r.period_start AS "periodStart", r.period_end AS "periodEnd", e.code AS "staffNo",
              e.first_name || ' ' || e.last_name AS employee, i.basic_salary AS basic, i.allowances + i.bonus AS "allowancesBonus",
              i.commission, i.gross_pay AS gross, i.lateness_deduction + i.absence_deduction AS attendance,
              i.loan_deduction + i.advance_deduction AS loans, i.other_deductions AS other, i.total_deductions AS deductions,
              i.net_pay AS net, i.amount_paid AS paid, i.status
       FROM payroll_items i JOIN payroll_runs r ON r.id = i.run_id JOIN employees e ON e.id = i.employee_id
       WHERE r.organization_id = $1 AND r.deleted_at IS NULL AND r.status IN ('approved', 'paid') AND r.pay_date BETWEEN $2 AND $3
         AND ($4::uuid IS NULL OR e.branch_id = $4) AND ($5::uuid IS NULL OR e.user_id = $5)
       ORDER BY r.period_start, employee LIMIT ${ROW_CAP}`,
      [f.organizationId, f.from, f.to, f.branchId, f.staffId ?? null]
    );
  }

  async creditors(organizationId: string, today: string): Promise<Array<Record<string, unknown>>> {
    return db().query(
      `SELECT * FROM (
         SELECT s.code, s.name, s.type, s.phone,
                COALESCE((SELECT SUM(total_cost) FROM supplies x WHERE x.supplier_id = s.id AND x.deleted_at IS NULL), 0) AS supplied,
                COALESCE((SELECT SUM(amount) FROM supplier_payments y WHERE y.supplier_id = s.id AND y.deleted_at IS NULL), 0) AS paid,
                COALESCE((SELECT SUM(total_cost - amount_paid) FROM supplies x WHERE x.supplier_id = s.id AND x.deleted_at IS NULL
                          AND x.amount_paid < x.total_cost AND x.due_date < $2), 0) AS overdue
         FROM suppliers s WHERE s.organization_id = $1 AND s.deleted_at IS NULL
       ) q WHERE q.supplied - q.paid > 0
       ORDER BY q.supplied - q.paid DESC LIMIT ${ROW_CAP}`,
      [organizationId, today]
    );
  }
}
