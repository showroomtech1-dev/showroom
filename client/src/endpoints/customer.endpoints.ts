import { downloadFile, wrapCall } from "@/transport/http"
import type {
  Customer,
  CustomerPayment,
  CustomerStatement,
  DebtorRow,
  ReceivablesSummary,
} from "@/types/customer.types"
import type { SaleHeader } from "@/types/sale.types"

export const CustomerEndpoints = {
  list: (params?: Record<string, unknown>) =>
    wrapCall<Customer[]>("GET", "/api/v1/customers", params),

  debtors: () =>
    wrapCall<DebtorRow[]>("GET", "/api/v1/customers/debtors", { format: "json" }),

  downloadDebtors: (format: "pdf" | "xlsx" | "csv") =>
    downloadFile("/api/v1/customers/debtors", `debtors.${format}`, { format }),

  receivables: () =>
    wrapCall<ReceivablesSummary>("GET", "/api/v1/customers/receivables"),

  get: (id: string) =>
    wrapCall<Customer>("GET", `/api/v1/customers/${id}`),

  purchases: (id: string, params?: Record<string, unknown>) =>
    wrapCall<SaleHeader[]>("GET", `/api/v1/customers/${id}/purchases`, params),

  statement: (id: string, params?: Record<string, unknown>) =>
    wrapCall<CustomerStatement>("GET", `/api/v1/customers/${id}/statement`, { ...params, format: "json" }),

  downloadStatement: (id: string, format: "pdf" | "xlsx" | "csv", params?: Record<string, unknown>) =>
    downloadFile(`/api/v1/customers/${id}/statement`, `customer-statement.${format}`, { ...params, format }),

  reminder: (id: string) =>
    wrapCall<{ message: string; whatsappUrl: string; balance: number }>("GET", `/api/v1/customers/${id}/reminder`),

  create: (payload: Record<string, unknown>) =>
    wrapCall<Customer>("POST", "/api/v1/customers", payload),

  update: (id: string, payload: Record<string, unknown>) =>
    wrapCall<Customer>("PATCH", `/api/v1/customers/${id}`, payload),

  remove: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/customers/${id}`),

  listPayments: (params?: Record<string, unknown>) =>
    wrapCall<CustomerPayment[]>("GET", "/api/v1/customer-payments", params),

  getPayment: (id: string) =>
    wrapCall<CustomerPayment>("GET", `/api/v1/customer-payments/${id}`),

  createPayment: (payload: Record<string, unknown>) =>
    wrapCall<CustomerPayment>("POST", "/api/v1/customer-payments", payload),

  removePayment: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/customer-payments/${id}`),
}
