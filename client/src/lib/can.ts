export const WILDCARD = "*"

const PERMISSION_ALIASES: Record<string, string> = {
  "product.create": "product.manage",
  "product.update": "product.manage",
  "product.delete": "product.manage",
  "product.view": "product.read",
  "inventory.cost.view": "product.viewcost",
  "inventory.stocktake": "stocktake.manage",
  "inventory.view": "inventory.read",
  "customer.view": "customer.read",
  "customer.payment": "customerpayment.create",
  "supplier.view": "supplier.read",
  "supply.view": "supplier.read",
  "supply.create": "supply.manage",
  "supply.delete": "supply.manage",
  "supplier.payment": "supplierpayment.manage",
  "expense.view": "expense.read",
  "expense.create": "expense.manage",
  "expense.delete": "expense.manage",
  "employee.view": "employee.read",
  "employee.create": "employee.manage",
  "employee.update": "employee.manage",
  "employee.delete": "employee.manage",
  "employee.salary.view": "payroll.read",
  "payroll.view": "payroll.read",
  "account.view": "account.read",
  "finance.view": "finance.read",
  "report.view": "report.read",
  "audit.view": "audit.read",
  "backup.export": "backup.manage",
}

export function can(permissions: readonly string[] | undefined | null, code: string): boolean {
  if (!permissions || permissions.length === 0) return false
  if (permissions.includes(WILDCARD) || permissions.includes(code)) return true
  const canonical = PERMISSION_ALIASES[code]
  return Boolean(canonical && permissions.includes(canonical))
}

export function canAny(permissions: readonly string[] | undefined | null, codes: readonly string[]): boolean {
  if (!codes || codes.length === 0) return true
  return codes.some((code) => can(permissions, code))
}

export function canAll(permissions: readonly string[] | undefined | null, codes: readonly string[]): boolean {
  if (!codes || codes.length === 0) return true
  return codes.every((code) => can(permissions, code))
}
