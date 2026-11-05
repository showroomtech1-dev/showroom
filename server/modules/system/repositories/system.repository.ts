// Backup export and soft-delete restore. Table and column names come only from the fixed maps
// below (never from user input); all values are bound parameters.
import { db, updateReturning, type Tx } from "../../../infrastructure/database/transaction";

/** Tables exported in a backup. Child tables are reached through their parent's organisation. */
const BACKUP_TABLES: Record<string, string> = {
  organizations: `SELECT * FROM organizations WHERE id = $1`,
  organization_settings: `SELECT * FROM organization_settings WHERE organization_id = $1`,
  branches: `SELECT * FROM branches WHERE organization_id = $1`,
  roles: `SELECT * FROM roles WHERE organization_id = $1`,
  users: `SELECT id, organization_id, branch_id, role_id, name, email, phone, is_active, last_login_at, created_at, updated_at, deleted_at FROM users WHERE organization_id = $1`,
  accounts: `SELECT * FROM accounts WHERE organization_id = $1`,
  account_transactions: `SELECT * FROM account_transactions WHERE organization_id = $1`,
  account_transfers: `SELECT * FROM account_transfers WHERE organization_id = $1`,
  suppliers: `SELECT * FROM suppliers WHERE organization_id = $1`,
  supplies: `SELECT * FROM supplies WHERE organization_id = $1`,
  supply_items: `SELECT i.* FROM supply_items i JOIN supplies x ON x.id = i.supply_id WHERE x.organization_id = $1`,
  supplier_payments: `SELECT * FROM supplier_payments WHERE organization_id = $1`,
  supplier_payment_allocations: `SELECT a.* FROM supplier_payment_allocations a JOIN supplier_payments p ON p.id = a.payment_id WHERE p.organization_id = $1`,
  product_categories: `SELECT * FROM product_categories WHERE organization_id = $1`,
  products: `SELECT * FROM products WHERE organization_id = $1`,
  product_variants: `SELECT * FROM product_variants WHERE organization_id = $1`,
  product_photos: `SELECT ph.* FROM product_photos ph JOIN products p ON p.id = ph.product_id WHERE p.organization_id = $1`,
  stock_levels: `SELECT * FROM stock_levels WHERE organization_id = $1`,
  stock_movements: `SELECT * FROM stock_movements WHERE organization_id = $1`,
  stock_takes: `SELECT * FROM stock_takes WHERE organization_id = $1`,
  stock_take_items: `SELECT i.* FROM stock_take_items i JOIN stock_takes t ON t.id = i.stock_take_id WHERE t.organization_id = $1`,
  customers: `SELECT * FROM customers WHERE organization_id = $1`,
  sales: `SELECT * FROM sales WHERE organization_id = $1`,
  sale_items: `SELECT i.* FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE s.organization_id = $1`,
  sale_payments: `SELECT * FROM sale_payments WHERE organization_id = $1`,
  customer_payments: `SELECT * FROM customer_payments WHERE organization_id = $1`,
  customer_payment_allocations: `SELECT a.* FROM customer_payment_allocations a JOIN customer_payments p ON p.id = a.payment_id WHERE p.organization_id = $1`,
  sale_returns: `SELECT * FROM sale_returns WHERE organization_id = $1`,
  sale_return_items: `SELECT i.* FROM sale_return_items i JOIN sale_returns r ON r.id = i.return_id WHERE r.organization_id = $1`,
  quotations: `SELECT * FROM quotations WHERE organization_id = $1`,
  quotation_items: `SELECT i.* FROM quotation_items i JOIN quotations q ON q.id = i.quotation_id WHERE q.organization_id = $1`,
  cash_reconciliations: `SELECT * FROM cash_reconciliations WHERE organization_id = $1`,
  expense_categories: `SELECT * FROM expense_categories WHERE organization_id = $1`,
  expenses: `SELECT * FROM expenses WHERE organization_id = $1`,
  recurring_expenses: `SELECT * FROM recurring_expenses WHERE organization_id = $1`,
  employees: `SELECT * FROM employees WHERE organization_id = $1`,
  employee_documents: `SELECT * FROM employee_documents WHERE organization_id = $1`,
  attendance: `SELECT * FROM attendance WHERE organization_id = $1`,
  leave_requests: `SELECT * FROM leave_requests WHERE organization_id = $1`,
  payroll_runs: `SELECT * FROM payroll_runs WHERE organization_id = $1`,
  payroll_items: `SELECT * FROM payroll_items WHERE organization_id = $1`,
  payroll_payments: `SELECT * FROM payroll_payments WHERE organization_id = $1`,
  payslips: `SELECT * FROM payslips WHERE organization_id = $1`,
  loans: `SELECT * FROM loans WHERE organization_id = $1`,
  loan_repayments: `SELECT * FROM loan_repayments WHERE organization_id = $1`,
  audit_logs: `SELECT * FROM audit_logs WHERE organization_id = $1`,
};

/** Records that can be restored from the trash: table + the column shown as its label. */
export const RESTORABLE = {
  supplier: { table: "suppliers", label: "name || ' (' || code || ')'" },
  customer: { table: "customers", label: "name || ' (' || code || ')'" },
  product: { table: "products", label: "name" },
  product_category: { table: "product_categories", label: "name" },
  employee: { table: "employees", label: "first_name || ' ' || last_name" },
  account: { table: "accounts", label: "name" },
  branch: { table: "branches", label: "name" },
  expense_category: { table: "expense_categories", label: "name" },
  recurring_expense: { table: "recurring_expenses", label: "name" },
  quotation: { table: "quotations", label: "code" },
  user: { table: "users", label: "name || ' <' || email || '>'" },
} as const;

export type RestorableType = keyof typeof RESTORABLE;

export class SystemRepository {
  static Instance = new SystemRepository();
  private constructor() {}

  async exportAll(organizationId: string): Promise<Record<string, unknown[]>> {
    const out: Record<string, unknown[]> = {};
    for (const [name, sql] of Object.entries(BACKUP_TABLES)) out[name] = await db().query(sql, [organizationId]);
    return out;
  }

  async trash(organizationId: string, type: RestorableType, limit: number): Promise<Array<{ id: string; label: string; deletedAt: Date }>> {
    const { table, label } = RESTORABLE[type];
    return db().query(
      `SELECT id, ${label} AS label, deleted_at AS "deletedAt" FROM ${table}
       WHERE organization_id = $1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT $2`,
      [organizationId, limit]
    );
  }

  async restore(organizationId: string, type: RestorableType, id: string, tx: Tx): Promise<{ label: string } | null> {
    const { table, label } = RESTORABLE[type];
    // A product's variants were deleted in the same transaction (same timestamp) — bring those back too,
    // but not variants that had been deleted on their own earlier.
    if (type === "product") {
      await tx.query(
        `UPDATE product_variants v SET deleted_at = NULL FROM products p
         WHERE p.id = $1 AND p.organization_id = $2 AND v.product_id = p.id AND v.deleted_at = p.deleted_at`,
        [id, organizationId]
      );
    }
    const rows = await updateReturning<{ label: string }>(
      tx,
      `UPDATE ${table} SET deleted_at = NULL WHERE organization_id = $1 AND id = $2 AND deleted_at IS NOT NULL
       RETURNING ${label} AS label`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }
}
