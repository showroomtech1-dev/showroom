import type { StockLevelRow } from "./inventory.types"

export interface DashboardSummary {
  date: string
  branchId: string | null
  today: { sales: number; salesCount: number; netSales: number }
  thisMonth: {
    sales: number
    salesCount: number
    netSales: number
    grossProfit: number | null
    expenses: number | null
    netProfit: number | null
  }
  stock: { lowCount: number; outCount: number; items: StockLevelRow[] }
  payables: {
    totalOutstanding: number
    overdueAmount: number
    overdueCount: number
    topSuppliers: Array<{ supplierId: string; name: string; type: string; supplied: number; balance: number }>
  } | null
  customerDebts: {
    totalOutstanding: number
    overdueAmount: number
    overdueCount: number
    debtorCount: number
    creditHeld: number
  } | null
  upcomingPayments: Array<{
    kind: "supplier" | "recurring_expense"
    id: string
    title: string
    reference: string
    dueDate: string
    amount: number
    overdue: boolean
  }>
  topProducts: Array<{
    variantId: string
    productName: string
    variantName: string | null
    sku: string
    quantity: number
    revenue: number
    cost?: number
  }>
  cashPosition: {
    total: number
    accounts: Array<{ id: string; name: string; type: string; balance: number }>
  } | null
}

export interface DashboardCharts {
  salesTrend: Array<{ date: string; total: number; count: number; grossProfit?: number }>
  expensesByCategory: Array<{ category: string; total: number }>
  /** Empty when the user can't see finance figures. */
  profitByMonth: Array<{ month: string; revenue: number; cogs: number; grossProfit: number; expenses: number; payroll: number; netProfit: number }>
}

export interface ExportTable {
  title: string
  subtitle?: string
  summary?: Array<{ label: string; value: number | string; type?: string }>
  columns: Array<{ key: string; label: string; type?: string; width?: number }>
  rows: Array<Record<string, unknown>>
  totals?: Record<string, unknown>
}
