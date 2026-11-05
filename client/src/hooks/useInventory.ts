import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { InventoryEndpoints } from "@/endpoints/inventory.endpoints"
import { ApiError } from "@/transport/http"
import { PRODUCTS_KEY } from "./useProducts"

export const INVENTORY_KEY = "inventory"
export const STOCK_TAKES_KEY = "stock-takes"

export function useStockLevels(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [INVENTORY_KEY, "levels", params],
    queryFn: async () => {
      const res = await InventoryEndpoints.levels(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useStockAlerts(branchId?: string) {
  return useQuery({
    queryKey: [INVENTORY_KEY, "alerts", branchId],
    queryFn: async () => {
      const res = await InventoryEndpoints.alerts(branchId)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useStockMovements(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [INVENTORY_KEY, "movements", params],
    queryFn: async () => {
      const res = await InventoryEndpoints.movements(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useInventoryValuation(branchId?: string) {
  return useQuery({
    queryKey: [INVENTORY_KEY, "valuation", branchId],
    queryFn: async () => {
      const res = await InventoryEndpoints.valuation(branchId)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      variantId: string
      branchId?: string
      mode?: "change" | "set"
      quantity: number
      reason: string
      note?: string
    }) => {
      const res = await InventoryEndpoints.adjust(payload)
      if (!res.success) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}

export function useTransferStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      fromBranchId?: string
      toBranchId: string
      note?: string
      items: Array<{ variantId: string; quantity: number }>
    }) => {
      const res = await InventoryEndpoints.transfer(payload)
      if (!res.success) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}

export function useStockTakes(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [STOCK_TAKES_KEY, params],
    queryFn: async () => {
      const res = await InventoryEndpoints.listStockTakes(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useStockTake(id: string) {
  return useQuery({
    queryKey: [STOCK_TAKES_KEY, id],
    queryFn: async () => {
      const res = await InventoryEndpoints.getStockTake(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useStockTakeItems(id: string, params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [STOCK_TAKES_KEY, id, "items", params],
    queryFn: async () => {
      const res = await InventoryEndpoints.listStockTakeItems(id, params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    enabled: Boolean(id),
  })
}

export function useStartStockTake() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { branchId?: string; categoryId?: string; notes?: string }) => {
      const res = await InventoryEndpoints.startStockTake(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [STOCK_TAKES_KEY] }),
  })
}

export function useRecordStockCounts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, counts }: { id: string; counts: Array<{ variantId: string; countedQuantity: number }> }) => {
      const res = await InventoryEndpoints.recordCounts(id, counts)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [STOCK_TAKES_KEY, vars.id] })
      qc.invalidateQueries({ queryKey: [STOCK_TAKES_KEY] })
    },
  })
}

export function useCompleteStockTake() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await InventoryEndpoints.completeStockTake(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STOCK_TAKES_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}

export function useCancelStockTake() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await InventoryEndpoints.cancelStockTake(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [STOCK_TAKES_KEY] }),
  })
}
