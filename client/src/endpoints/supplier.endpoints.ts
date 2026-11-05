import { downloadFile, uploadWithFields, wrapCall } from "@/transport/http"
import type {
  PayablesSummary,
  RecordSupplierPaymentResult,
  Supplier,
  SupplierPayment,
  SupplierStatement,
  SupplyDetail,
  SupplyListItem,
} from "@/types/supplier.types"

export const SupplierEndpoints = {
  list: (params?: Record<string, unknown>) =>
    wrapCall<Supplier[]>("GET", "/api/v1/suppliers", params),

  payables: (type?: "supplier" | "vendor") =>
    wrapCall<PayablesSummary>("GET", "/api/v1/suppliers/payables", type ? { type } : undefined),

  get: (id: string) =>
    wrapCall<Supplier>("GET", `/api/v1/suppliers/${id}`),

  statement: (id: string, params?: Record<string, unknown>) =>
    wrapCall<SupplierStatement>("GET", `/api/v1/suppliers/${id}/statement`, { ...params, format: "json" }),

  downloadStatement: (id: string, format: "pdf" | "xlsx" | "csv", params?: Record<string, unknown>) =>
    downloadFile(`/api/v1/suppliers/${id}/statement`, `supplier-statement.${format}`, { ...params, format }),

  create: (payload: Record<string, unknown>) =>
    wrapCall<Supplier>("POST", "/api/v1/suppliers", payload),

  update: (id: string, payload: Record<string, unknown>) =>
    wrapCall<Supplier>("PATCH", `/api/v1/suppliers/${id}`, payload),

  remove: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/suppliers/${id}`),

  listSupplies: (params?: Record<string, unknown>) =>
    wrapCall<SupplyListItem[]>("GET", "/api/v1/supplies", params),

  getSupply: (id: string) =>
    wrapCall<SupplyDetail>("GET", `/api/v1/supplies/${id}`),

  createSupply: (payload: Record<string, unknown>) =>
    wrapCall<SupplyDetail>("POST", "/api/v1/supplies", payload),

  updateSupply: (id: string, payload: Record<string, unknown>) =>
    wrapCall<SupplyDetail>("PATCH", `/api/v1/supplies/${id}`, payload),

  removeSupply: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/supplies/${id}`),

  listPayments: (params?: Record<string, unknown>) =>
    wrapCall<SupplierPayment[]>("GET", "/api/v1/supplier-payments", params),

  getPayment: (id: string) =>
    wrapCall<SupplierPayment>("GET", `/api/v1/supplier-payments/${id}`),

  createPayment: (payload: Record<string, unknown>) =>
    wrapCall<RecordSupplierPaymentResult>("POST", "/api/v1/supplier-payments", payload),

  removePayment: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/supplier-payments/${id}`),

  uploadPaymentProof: (id: string, file: File) =>
    uploadWithFields<SupplierPayment>(`/api/v1/supplier-payments/${id}/proof`, file, {}, "proof"),
}
