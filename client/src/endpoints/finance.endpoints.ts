import { downloadFile, wrapCall } from "@/transport/http"
import type {
  Account,
  AccountOption,
  AccountStatement,
  AccountTransfer,
  CashFlow,
  PayablesReceivables,
  ProfitAndLoss,
} from "@/types/finance.types"
import type { DashboardCharts, DashboardSummary, ExportTable } from "@/types/dashboard.types"

export const FinanceEndpoints = {
  dashboardSummary: (branchId?: string) =>
    wrapCall<DashboardSummary>("GET", "/api/v1/dashboard", branchId ? { branchId } : undefined),

  dashboardCharts: (params?: { branchId?: string; days?: number; months?: number }) =>
    wrapCall<DashboardCharts>("GET", "/api/v1/dashboard/charts", params as Record<string, unknown>),

  listAccounts: (params?: { branchId?: string; includeInactive?: boolean }) =>
    wrapCall<Account[]>("GET", "/api/v1/accounts", params as Record<string, unknown>),

  accountOptions: () =>
    wrapCall<AccountOption[]>("GET", "/api/v1/accounts/options"),

  getAccount: (id: string) =>
    wrapCall<Account>("GET", `/api/v1/accounts/${id}`),

  accountStatement: (id: string, params?: { from?: string; to?: string }) =>
    wrapCall<AccountStatement>("GET", `/api/v1/accounts/${id}/statement`, params as Record<string, unknown>),

  createAccount: (payload: Record<string, unknown>) =>
    wrapCall<Account>("POST", "/api/v1/accounts", payload),

  updateAccount: (id: string, payload: Record<string, unknown>) =>
    wrapCall<Account>("PATCH", `/api/v1/accounts/${id}`, payload),

  removeAccount: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/accounts/${id}`),

  listTransfers: (params?: Record<string, unknown>) =>
    wrapCall<AccountTransfer[]>("GET", "/api/v1/account-transfers", params),

  createTransfer: (payload: Record<string, unknown>) =>
    wrapCall<AccountTransfer>("POST", "/api/v1/account-transfers", payload),

  removeTransfer: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/account-transfers/${id}`),

  profitAndLoss: (params?: { from?: string; to?: string; branchId?: string }) =>
    wrapCall<ProfitAndLoss>("GET", "/api/v1/finance/profit-and-loss", params as Record<string, unknown>),

  cashFlow: (params?: { from?: string; to?: string; branchId?: string }) =>
    wrapCall<CashFlow>("GET", "/api/v1/finance/cash-flow", params as Record<string, unknown>),

  profitTrend: (params?: { months?: number; branchId?: string }) =>
    wrapCall<Array<{ month: string; revenue: number; cost: number; expenses: number; netProfit: number }>>(
      "GET",
      "/api/v1/finance/profit-trend",
      params as Record<string, unknown>
    ),

  payablesReceivables: () =>
    wrapCall<PayablesReceivables>("GET", "/api/v1/finance/payables-receivables"),

  reportTypes: () =>
    wrapCall<string[]>("GET", "/api/v1/reports"),

  runReport: (type: string, params?: Record<string, unknown>) =>
    wrapCall<ExportTable>("GET", `/api/v1/reports/${type}`, { ...params, format: "json" }),

  exportReport: (type: string, format: "pdf" | "xlsx" | "csv", params?: Record<string, unknown>) =>
    downloadFile(`/api/v1/reports/${type}`, `${type}-report.${format}`, { ...params, format }),
}
