// Domain constants shared by validators, services and seeds.

export const PAYMENT_METHODS = ["cash", "transfer", "pos", "cheque"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ACCOUNT_TYPES = ["cash", "bank", "pos"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Which kind of money account a payment method lands in when no account is chosen. */
export const METHOD_ACCOUNT_TYPE: Record<PaymentMethod, AccountType> = {
  cash: "cash",
  transfer: "bank",
  cheque: "bank",
  pos: "pos",
};

export const SUPPLIER_TYPES = ["supplier", "vendor"] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

export const SETTLEMENT_STATUSES = ["paid", "part_paid", "credit"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const STOCK_MOVEMENT_TYPES = [
  "opening",
  "supply",
  "supply_reversal",
  "sale",
  "sale_return",
  "sale_void",
  "adjustment",
  "stock_take",
  "transfer_in",
  "transfer_out",
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const ADJUSTMENT_REASONS = ["damage", "theft", "correction", "expired", "gift", "other"] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const LEDGER_TYPES = [
  "sale_payment",
  "customer_payment",
  "sale_refund",
  "supplier_payment",
  "expense",
  "payroll_payment",
  "loan_disbursement",
  "loan_repayment",
  "transfer_in",
  "transfer_out",
  "cash_adjustment",
  "reversal",
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export const EXPENSE_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type ExpenseFrequency = (typeof EXPENSE_FREQUENCIES)[number];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Fuel",
  "Internet",
  "Maintenance",
  "Marketing",
  "Transport",
  "Taxes",
  "Miscellaneous",
] as const;

export const PAY_FREQUENCIES = ["monthly", "weekly"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "leave", "half_day", "off"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const LEAVE_TYPES = ["annual", "sick", "casual", "maternity", "paternity", "unpaid", "other"] as const;
export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

export const LOAN_TYPES = ["loan", "advance"] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

export const QUOTATION_STATUSES = ["draft", "sent", "accepted", "converted", "expired", "cancelled"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const EXPORT_FORMATS = ["json", "csv", "xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Storage folders, one per domain (Cloudinary). */
export const STORAGE_FOLDERS = {
  logo: "showroompro/branding",
  product: "showroompro/products",
  supplierPayment: "showroompro/supplier-payments",
  expense: "showroompro/expenses",
  employee: "showroompro/employees",
  employeeDocument: "showroompro/employee-documents",
} as const;

/** Amounts are integers in the currency's minor unit (kobo for NGN). 10^13 = ₦100bn. */
export const MAX_MONEY = 10_000_000_000_000;
