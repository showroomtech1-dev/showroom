import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CustomerEndpoints } from "@/endpoints/customer.endpoints"
import { ApiError } from "@/transport/http"
import { SALES_KEY } from "./useSales"

export const CUSTOMERS_KEY = "customers"
export const CUSTOMER_PAYMENTS_KEY = "customer-payments"

export function useCustomers(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: [CUSTOMERS_KEY, params],
    queryFn: async () => {
      const res = await CustomerEndpoints.list(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    enabled,
  })
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: [CUSTOMERS_KEY, id],
    queryFn: async () => {
      const res = await CustomerEndpoints.get(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useCustomerPurchases(id: string, params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [CUSTOMERS_KEY, id, "purchases", params],
    queryFn: async () => {
      const res = await CustomerEndpoints.purchases(id, params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    enabled: Boolean(id),
  })
}

export function useCustomerStatement(id: string, params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [CUSTOMERS_KEY, id, "statement", params],
    queryFn: async () => {
      const res = await CustomerEndpoints.statement(id, params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useDebtors() {
  return useQuery({
    queryKey: [CUSTOMERS_KEY, "debtors"],
    queryFn: async () => {
      const res = await CustomerEndpoints.debtors()
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
  })
}

export function useReceivablesSummary() {
  return useQuery({
    queryKey: [CUSTOMERS_KEY, "receivables"],
    queryFn: async () => {
      const res = await CustomerEndpoints.receivables()
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useSaveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id
        ? await CustomerEndpoints.update(id, payload)
        : await CustomerEndpoints.create(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY] }),
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await CustomerEndpoints.remove(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY] }),
  })
}

export function useCustomerPayments(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [CUSTOMER_PAYMENTS_KEY, params],
    queryFn: async () => {
      const res = await CustomerEndpoints.listPayments(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useCreateCustomerPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await CustomerEndpoints.createPayment(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CUSTOMER_PAYMENTS_KEY] })
      qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY] })
      qc.invalidateQueries({ queryKey: [SALES_KEY] })
    },
  })
}

export function useDeleteCustomerPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await CustomerEndpoints.removePayment(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CUSTOMER_PAYMENTS_KEY] })
      qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY] })
      qc.invalidateQueries({ queryKey: [SALES_KEY] })
    },
  })
}

export function useCustomerReminder() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await CustomerEndpoints.reminder(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useEmailCustomerReminder() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await CustomerEndpoints.emailReminder(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}
