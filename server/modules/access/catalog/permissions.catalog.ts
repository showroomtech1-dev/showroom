// Single source of truth for permission codes (`resource.action`). Routes and services check these;
// roles are just named bundles of them. Never branch on a role name in application code.

export interface PermissionDefinition {
  code: string;
  category: string;
  label: string;
}

export const PERMISSIONS = [
  // ── Administration ─────────────────────────────────────────────────────────
  { code: "settings.manage", category: "Administration", label: "Change business settings, tax, currency, receipt layout" },
  { code: "branch.manage", category: "Administration", label: "Create and edit branches / locations" },
  { code: "branch.all", category: "Administration", label: "Work across every branch (otherwise only the user's own branch)" },
  { code: "user.manage", category: "Administration", label: "Create users, assign roles, reset passwords" },
  { code: "role.manage", category: "Administration", label: "Create and edit custom roles" },
  { code: "audit.read", category: "Administration", label: "View the audit log" },
  { code: "backup.manage", category: "Administration", label: "Export a full data backup" },
  { code: "trash.manage", category: "Administration", label: "View and restore deleted records" },

  // ── Finance ────────────────────────────────────────────────────────────────
  { code: "account.read", category: "Finance", label: "View cash, bank and POS accounts and their transactions" },
  { code: "account.manage", category: "Finance", label: "Create accounts and transfer money between them" },
  { code: "finance.read", category: "Finance", label: "View profit & loss, cash flow, payables and receivables" },

  // ── Suppliers & vendors ────────────────────────────────────────────────────
  { code: "supplier.read", category: "Suppliers", label: "View suppliers, vendors, supplies and ledgers" },
  { code: "supplier.manage", category: "Suppliers", label: "Create and edit suppliers and vendors" },
  { code: "supply.manage", category: "Suppliers", label: "Record and edit goods received from suppliers" },
  { code: "supplierpayment.manage", category: "Suppliers", label: "Record payments to suppliers and vendors" },

  // ── Inventory ──────────────────────────────────────────────────────────────
  { code: "product.read", category: "Inventory", label: "View products and selling prices" },
  { code: "product.viewcost", category: "Inventory", label: "See cost prices and inventory value at cost" },
  { code: "product.manage", category: "Inventory", label: "Create and edit products, variants, categories and photos" },
  { code: "inventory.read", category: "Inventory", label: "View stock levels, movements and alerts" },
  { code: "inventory.adjust", category: "Inventory", label: "Adjust stock for damage, theft or correction" },
  { code: "inventory.transfer", category: "Inventory", label: "Move stock between branches" },
  { code: "stocktake.manage", category: "Inventory", label: "Run physical stock counts and apply variances" },

  // ── Sales & customers ──────────────────────────────────────────────────────
  { code: "sale.create", category: "Sales", label: "Record sales at the point of sale" },
  { code: "sale.readall", category: "Sales", label: "View every staff member's sales (otherwise only own)" },
  { code: "sale.priceoverride", category: "Sales", label: "Sell at a price different from the list price" },
  { code: "sale.backdate", category: "Sales", label: "Record a sale with an earlier date" },
  { code: "sale.void", category: "Sales", label: "Void a sale (reverses stock and payments)" },
  { code: "sale.return", category: "Sales", label: "Process returns and refunds" },
  { code: "quotation.manage", category: "Sales", label: "Create quotations / proforma invoices and convert them" },
  { code: "customer.read", category: "Sales", label: "View customers, purchase history and debts" },
  { code: "customer.manage", category: "Sales", label: "Create and edit customers" },
  { code: "customerpayment.create", category: "Sales", label: "Record customer debt payments" },
  { code: "customerpayment.delete", category: "Sales", label: "Delete customer payments (reverses the money)" },
  { code: "cashup.manage", category: "Sales", label: "Close the day: count cash and reconcile" },

  // ── Expenses ───────────────────────────────────────────────────────────────
  { code: "expense.read", category: "Expenses", label: "View expenses and expense reports" },
  { code: "expense.manage", category: "Expenses", label: "Record expenses, categories and recurring expenses" },

  // ── People & payroll ───────────────────────────────────────────────────────
  { code: "employee.read", category: "People", label: "View employee profiles, attendance and leave" },
  { code: "employee.manage", category: "People", label: "Create and edit employees and their documents" },
  { code: "attendance.clock", category: "People", label: "Clock yourself in and out" },
  { code: "attendance.manage", category: "People", label: "Mark attendance for any employee" },
  { code: "leave.request", category: "People", label: "Request leave for yourself" },
  { code: "leave.manage", category: "People", label: "Record, approve and reject leave" },
  { code: "payroll.read", category: "Payroll", label: "View payroll runs, payslips and employee ledgers" },
  { code: "payroll.manage", category: "Payroll", label: "Prepare payroll runs (allowances, deductions, bonuses)" },
  { code: "payroll.approve", category: "Payroll", label: "Approve payroll runs" },
  { code: "payroll.pay", category: "Payroll", label: "Record salary payments and issue payslips" },
  { code: "loan.manage", category: "Payroll", label: "Issue staff loans and salary advances" },

  // ── Dashboard & reports ────────────────────────────────────────────────────
  { code: "dashboard.read", category: "Reports", label: "View the business dashboard and charts" },
  { code: "report.read", category: "Reports", label: "View reports" },
  { code: "report.export", category: "Reports", label: "Export reports and statements to PDF, Excel and CSV" },
] as const satisfies readonly PermissionDefinition[];

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

export const WILDCARD = "*";

export const PERMISSION_CODES: readonly PermissionCode[] = PERMISSIONS.map((p) => p.code);

export function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value);
}
