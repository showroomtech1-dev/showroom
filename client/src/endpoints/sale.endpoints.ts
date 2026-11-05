import { openPdfInNewTab, wrapCall } from "@/transport/http"
import type {
  CashReconciliation,
  CashupPreview,
  DailySalesSummary,
  Quotation,
  SaleCreatedResult,
  SaleDetail,
  SaleHeader,
  SaleReturn,
} from "@/types/sale.types"

export const SaleEndpoints = {
  list: (params?: Record<string, unknown>) =>
    wrapCall<SaleHeader[]>("GET", "/api/v1/sales", params),

  get: (id: string) =>
    wrapCall<SaleDetail>("GET", `/api/v1/sales/${id}`),

  create: (payload: Record<string, unknown>) =>
    wrapCall<SaleCreatedResult>("POST", "/api/v1/sales", payload),

  voidSale: (id: string, reason: string) =>
    wrapCall<SaleDetail>("POST", `/api/v1/sales/${id}/void`, { reason }),

  openReceiptPdf: (id: string, size: "thermal" | "a4" = "thermal") =>
    openPdfInNewTab(`/api/v1/sales/${id}/receipt`, { size }),

  share: (id: string) =>
    wrapCall<{ receiptUrl: string; message: string; whatsappUrl: string }>("GET", `/api/v1/sales/${id}/share`),

  dailySummary: (params?: { date?: string; branchId?: string }) =>
    wrapCall<DailySalesSummary>("GET", "/api/v1/sales/daily-summary", params as Record<string, unknown>),

  commissions: (params?: Record<string, unknown>) =>
    wrapCall<{
      from: string
      to: string
      sellers: Array<{ soldById: string; soldByName: string; salesCount: number; totalSales: number; netSales: number; returned: number; commission: number }>
      totalCommission: number
    }>("GET", "/api/v1/sales/commissions", params),

  listReturns: (params?: Record<string, unknown>) =>
    wrapCall<SaleReturn[]>("GET", "/api/v1/sale-returns", params),

  getReturn: (id: string) =>
    wrapCall<SaleReturn>("GET", `/api/v1/sale-returns/${id}`),

  createReturn: (payload: Record<string, unknown>) =>
    wrapCall<SaleReturn>("POST", "/api/v1/sale-returns", payload),

  listQuotations: (params?: Record<string, unknown>) =>
    wrapCall<Quotation[]>("GET", "/api/v1/quotations", params),

  getQuotation: (id: string) =>
    wrapCall<Quotation>("GET", `/api/v1/quotations/${id}`),

  openQuotationPdf: (id: string, title: "quotation" | "proforma" = "quotation") =>
    openPdfInNewTab(`/api/v1/quotations/${id}/pdf`, { title }),

  createQuotation: (payload: Record<string, unknown>) =>
    wrapCall<Quotation>("POST", "/api/v1/quotations", payload),

  updateQuotation: (id: string, payload: Record<string, unknown>) =>
    wrapCall<Quotation>("PATCH", `/api/v1/quotations/${id}`, payload),

  setQuotationStatus: (id: string, status: "sent" | "accepted" | "cancelled") =>
    wrapCall<Quotation>("POST", `/api/v1/quotations/${id}/status`, { status }),

  convertQuotation: (id: string, payload: Record<string, unknown>) =>
    wrapCall<SaleCreatedResult>("POST", `/api/v1/quotations/${id}/convert`, payload),

  removeQuotation: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/quotations/${id}`),

  previewCashup: (params?: { date?: string; branchId?: string; accountId?: string }) =>
    wrapCall<CashupPreview>("GET", "/api/v1/cash-ups/preview", params as Record<string, unknown>),

  listCashups: (params?: Record<string, unknown>) =>
    wrapCall<CashReconciliation[]>("GET", "/api/v1/cash-ups", params),

  closeCashup: (payload: Record<string, unknown>) =>
    wrapCall<CashReconciliation>("POST", "/api/v1/cash-ups", payload),
}
