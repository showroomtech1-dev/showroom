import { wrapCall } from "@/transport/http"
import type {
  InventoryValuation,
  StockLevelRow,
  StockMovement,
  StockTake,
  StockTakeItem,
} from "@/types/inventory.types"

export const InventoryEndpoints = {
  levels: (params?: Record<string, unknown>) =>
    wrapCall<StockLevelRow[]>("GET", "/api/v1/inventory/levels", params),

  alerts: (branchId?: string) =>
    wrapCall<{ low: number; out: number }>("GET", "/api/v1/inventory/alerts", branchId ? { branchId } : undefined),

  movements: (params?: Record<string, unknown>) =>
    wrapCall<StockMovement[]>("GET", "/api/v1/inventory/movements", params),

  valuation: (branchId?: string) =>
    wrapCall<InventoryValuation>("GET", "/api/v1/inventory/valuation", branchId ? { branchId } : undefined),

  adjust: (payload: {
    variantId: string
    branchId?: string
    mode?: "change" | "set"
    quantity: number
    reason: string
    note?: string
  }) =>
    wrapCall<unknown>("POST", "/api/v1/inventory/adjustments", payload as unknown as Record<string, unknown>),

  transfer: (payload: {
    fromBranchId?: string
    toBranchId: string
    note?: string
    items: Array<{ variantId: string; quantity: number }>
  }) =>
    wrapCall<unknown>("POST", "/api/v1/inventory/transfers", payload as unknown as Record<string, unknown>),

  listStockTakes: (params?: Record<string, unknown>) =>
    wrapCall<StockTake[]>("GET", "/api/v1/stock-takes", params),

  getStockTake: (id: string) =>
    wrapCall<StockTake>("GET", `/api/v1/stock-takes/${id}`),

  listStockTakeItems: (id: string, params?: Record<string, unknown>) =>
    wrapCall<StockTakeItem[]>("GET", `/api/v1/stock-takes/${id}/items`, params),

  startStockTake: (payload: { branchId?: string; categoryId?: string; notes?: string }) =>
    wrapCall<StockTake>("POST", "/api/v1/stock-takes", payload as Record<string, unknown>),

  recordCounts: (id: string, counts: Array<{ variantId: string; countedQuantity: number }>) =>
    wrapCall<StockTake>("POST", `/api/v1/stock-takes/${id}/counts`, { counts }),

  completeStockTake: (id: string) =>
    wrapCall<StockTake>("POST", `/api/v1/stock-takes/${id}/complete`),

  cancelStockTake: (id: string) =>
    wrapCall<StockTake>("POST", `/api/v1/stock-takes/${id}/cancel`),
}
