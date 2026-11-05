import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SaleEndpoints } from "@/endpoints/sale.endpoints"
import { ApiError } from "@/transport/http"
import { INVENTORY_KEY } from "./useInventory"
import { PRODUCTS_KEY } from "./useProducts"

export const SALES_KEY = "sales"
export const RETURNS_KEY = "sale-returns"
export const QUOTATIONS_KEY = "quotations"
export const CASHUPS_KEY = "cash-ups"

export function useSales(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [SALES_KEY, params],
    queryFn: async () => {
      const res = await SaleEndpoints.list(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useSale(id: string) {
  return useQuery({
    queryKey: [SALES_KEY, id],
    queryFn: async () => {
      const res = await SaleEndpoints.get(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useCreateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await SaleEndpoints.create(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SALES_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}

export function useVoidSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await SaleEndpoints.voidSale(id, reason)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [SALES_KEY, vars.id] })
      qc.invalidateQueries({ queryKey: [SALES_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}

export function useShareSale() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await SaleEndpoints.share(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useDailySummary(params: { date?: string; branchId?: string } = {}) {
  return useQuery({
    queryKey: [SALES_KEY, "daily-summary", params],
    queryFn: async () => {
      const res = await SaleEndpoints.dailySummary(params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useCommissions(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [SALES_KEY, "commissions", params],
    queryFn: async () => {
      const res = await SaleEndpoints.commissions(params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useSaleReturns(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [RETURNS_KEY, params],
    queryFn: async () => {
      const res = await SaleEndpoints.listReturns(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useCreateSaleReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await SaleEndpoints.createReturn(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RETURNS_KEY] })
      qc.invalidateQueries({ queryKey: [SALES_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}

export function useQuotations(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [QUOTATIONS_KEY, params],
    queryFn: async () => {
      const res = await SaleEndpoints.listQuotations(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useQuotation(id: string) {
  return useQuery({
    queryKey: [QUOTATIONS_KEY, id],
    queryFn: async () => {
      const res = await SaleEndpoints.getQuotation(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useSaveQuotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id ? await SaleEndpoints.updateQuotation(id, payload) : await SaleEndpoints.createQuotation(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUOTATIONS_KEY] }),
  })
}

export function useSetQuotationStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "sent" | "accepted" | "cancelled" }) => {
      const res = await SaleEndpoints.setQuotationStatus(id, status)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUOTATIONS_KEY] }),
  })
}

export function useConvertQuotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await SaleEndpoints.convertQuotation(id, payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUOTATIONS_KEY] })
      qc.invalidateQueries({ queryKey: [SALES_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}

export function useDeleteQuotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await SaleEndpoints.removeQuotation(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUOTATIONS_KEY] }),
  })
}

export function useCashupPreview(params: { date?: string; branchId?: string; accountId?: string } = {}) {
  return useQuery({
    queryKey: [CASHUPS_KEY, "preview", params],
    queryFn: async () => {
      const res = await SaleEndpoints.previewCashup(params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useCashups(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [CASHUPS_KEY, params],
    queryFn: async () => {
      const res = await SaleEndpoints.listCashups(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useCloseCashup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await SaleEndpoints.closeCashup(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CASHUPS_KEY] }),
  })
}

/** Emails the receipt to the sale's customer; the server explains if there's no email address. */
export function useEmailReceipt() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await SaleEndpoints.emailReceipt(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}
