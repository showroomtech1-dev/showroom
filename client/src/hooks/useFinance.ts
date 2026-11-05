import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FinanceEndpoints } from "@/endpoints/finance.endpoints"
import { ApiError } from "@/transport/http"

export const DASHBOARD_KEY = "dashboard"
export const ACCOUNTS_KEY = "accounts"
export const TRANSFERS_KEY = "account-transfers"
export const FINANCE_KEY = "finance-reports"
export const REPORTS_KEY = "reports"

export function useDashboardSummary(branchId?: string, enabled = true) {
  return useQuery({
    queryKey: [DASHBOARD_KEY, "summary", branchId],
    queryFn: async () => {
      const res = await FinanceEndpoints.dashboardSummary(branchId)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled,
  })
}

export function useDashboardCharts(params: { branchId?: string; days?: number; months?: number } = {}, enabled = true) {
  return useQuery({
    queryKey: [DASHBOARD_KEY, "charts", params],
    queryFn: async () => {
      const res = await FinanceEndpoints.dashboardCharts(params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled,
  })
}

export function useAccounts(params: { branchId?: string; includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: [ACCOUNTS_KEY, params],
    queryFn: async () => {
      const res = await FinanceEndpoints.listAccounts(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
  })
}

export function useAccountOptions(enabled = true) {
  return useQuery({
    queryKey: [ACCOUNTS_KEY, "options"],
    queryFn: async () => {
      const res = await FinanceEndpoints.accountOptions()
      if (!res.success) return []
      return res.data ?? []
    },
    enabled,
  })
}

export function useAccountStatement(id: string, params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: [ACCOUNTS_KEY, id, "statement", params],
    queryFn: async () => {
      const res = await FinanceEndpoints.accountStatement(id, params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useSaveAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id
        ? await FinanceEndpoints.updateAccount(id, payload)
        : await FinanceEndpoints.createAccount(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await FinanceEndpoints.removeAccount(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] }),
  })
}

export function useAccountTransfers(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [TRANSFERS_KEY, params],
    queryFn: async () => {
      const res = await FinanceEndpoints.listTransfers(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useCreateTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await FinanceEndpoints.createTransfer(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TRANSFERS_KEY] })
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] })
    },
  })
}

export function useDeleteTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await FinanceEndpoints.removeTransfer(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TRANSFERS_KEY] })
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] })
    },
  })
}

export function useProfitAndLoss(params: { from?: string; to?: string; branchId?: string } = {}) {
  return useQuery({
    queryKey: [FINANCE_KEY, "pnl", params],
    queryFn: async () => {
      const res = await FinanceEndpoints.profitAndLoss(params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useCashFlow(params: { from?: string; to?: string; branchId?: string } = {}) {
  return useQuery({
    queryKey: [FINANCE_KEY, "cashflow", params],
    queryFn: async () => {
      const res = await FinanceEndpoints.cashFlow(params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function usePayablesReceivables() {
  return useQuery({
    queryKey: [FINANCE_KEY, "payables-receivables"],
    queryFn: async () => {
      const res = await FinanceEndpoints.payablesReceivables()
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useReportData(type: string, params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [REPORTS_KEY, type, params],
    queryFn: async () => {
      const res = await FinanceEndpoints.runReport(type, params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(type) && (type !== "supplier-statement" || Boolean(params.supplierId)),
  })
}
