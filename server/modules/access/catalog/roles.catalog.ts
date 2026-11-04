// Built-in roles seeded for every organisation. The owner role is locked (cannot be edited or deleted).
import { PERMISSION_CODES, WILDCARD, type PermissionCode } from "./permissions.catalog";

export interface BuiltInRole {
  key: string;
  name: string;
  description: string;
  locked: boolean;
  permissions: readonly string[];
}

const exclude = (...codes: PermissionCode[]): PermissionCode[] =>
  PERMISSION_CODES.filter((code) => !codes.includes(code));

export const OWNER_ROLE_KEY = "owner";

export const BUILT_IN_ROLES: readonly BuiltInRole[] = [
  {
    key: OWNER_ROLE_KEY,
    name: "Owner / Admin",
    description: "Full access to everything in the business.",
    locked: true,
    permissions: [WILDCARD],
  },
  {
    key: "manager",
    name: "Manager",
    description: "Runs daily operations. Everything except settings, user management and payroll approval.",
    locked: false,
    permissions: exclude("settings.manage", "user.manage", "role.manage", "backup.manage", "payroll.approve"),
  },
  {
    key: "sales_staff",
    name: "Sales Staff",
    description: "Records sales, serves customers and checks stock.",
    locked: false,
    permissions: [
      "product.read",
      "inventory.read",
      "sale.create",
      "quotation.manage",
      "customer.read",
      "customer.manage",
      "customerpayment.create",
      "attendance.clock",
      "leave.request",
    ] satisfies PermissionCode[],
  },
  {
    key: "accountant",
    name: "Accountant",
    description: "Handles expenses, payments, accounts and reports.",
    locked: false,
    permissions: [
      "branch.all",
      "audit.read",
      "account.read",
      "account.manage",
      "finance.read",
      "supplier.read",
      "supplierpayment.manage",
      "product.read",
      "product.viewcost",
      "inventory.read",
      "sale.readall",
      "customer.read",
      "customerpayment.create",
      "customerpayment.delete",
      "cashup.manage",
      "expense.read",
      "expense.manage",
      "employee.read",
      "payroll.read",
      "payroll.pay",
      "loan.manage",
      "attendance.clock",
      "leave.request",
      "dashboard.read",
      "report.read",
      "report.export",
    ] satisfies PermissionCode[],
  },
];
