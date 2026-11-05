import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SupplierEndpoints } from "@/endpoints/supplier.endpoints"
import { ApiError } from "@/transport/http"
import { INVENTORY_KEY } from "./useInventory"
import { PRODUCTS_KEY } from "./useProducts"

export const SUPPLIERS_KEY = "suppliers"
export const SUPPLIES_KEY = "supplies"
export const SUPPLIER_PAYMENTS_KEY = "supplier-payments"

export function useSuppliers(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, params],
    queryFn: async () => {
      const res = await SupplierEndpoints.list(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    enabled,
  })
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, id],
    queryFn: async () => {
      const res = await SupplierEndpoints.get(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function usePayablesSummary(type?: "supplier" | "vendor") {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, "payables", type],
    queryFn: async () => {
      const res = await SupplierEndpoints.payables(type)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useSupplierStatement(id: string, params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, id, "statement", params],
    queryFn: async () => {
      const res = await SupplierEndpoints.statement(id, params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useSaveSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id
        ? await SupplierEndpoints.update(id, payload)
        : await SupplierEndpoints.create(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SUPPLIERS_KEY] }),
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await SupplierEndpoints.remove(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SUPPLIERS_KEY] }),
  })
}

export function useSupplies(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [SUPPLIES_KEY, params],
    queryFn: async () => {
      const res = await SupplierEndpoints.listSupplies(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useSupply(id: string) {
  return useQuery({
    queryKey: [SUPPLIES_KEY, id],
    queryFn: async () => {
      const res = await SupplierEndpoints.getSupply(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useCreateSupply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await SupplierEndpoints.createSupply(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUPPLIES_KEY] })
      qc.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}

export function useDeleteSupply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await SupplierEndpoints.removeSupply(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUPPLIES_KEY] })
      qc.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}

export function useSupplierPayments(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [SUPPLIER_PAYMENTS_KEY, params],
    queryFn: async () => {
      const res = await SupplierEndpoints.listPayments(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useCreateSupplierPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await SupplierEndpoints.createPayment(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUPPLIER_PAYMENTS_KEY] })
      qc.invalidateQueries({ queryKey: [SUPPLIES_KEY] })
      qc.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
    },
  })
}

export function useUploadPaymentProof() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const res = await SupplierEndpoints.uploadPaymentProof(id, file)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SUPPLIER_PAYMENTS_KEY] }),
  })
}

export function useDeleteSupplierPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await SupplierEndpoints.removePayment(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUPPLIER_PAYMENTS_KEY] })
      qc.invalidateQueries({ queryKey: [SUPPLIES_KEY] })
      qc.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
    },
  })
}
