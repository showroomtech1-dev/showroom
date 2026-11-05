export interface SaleHeader {
  id: string
  code: string
  branchId: string
  branchName: string
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  soldById: string
  soldByName: string
  soldAt: string
  status: "completed" | "voided"
  subtotal: number
  discountTotal: number
  taxRateBps: number
  taxAmount: number
  total: number
  amountPaid: number
  balanceDue: number
  paymentStatus: "paid" | "part_paid" | "credit"
  dueDate: string | null
  costTotal?: number
  commissionRateBps: number
  commissionAmount: number
  returnedAmount: number
  notes: string | null
  receiptToken: string
  quotationId: string | null
  voidedAt: string | null
  voidReason: string | null
  itemCount: number
  createdAt: string
}

export interface SaleItem {
  id: string
  variantId: string
  productId: string
  productName: string
  variantName: string | null
  sku: string
  quantity: number
  unitPrice: number
  listPrice: number
  discount: number
  lineTotal: number
  unitCost?: number
  returnedQuantity: number
}

export interface SalePayment {
  id: string
  method: string
  accountId: string
  accountName: string
  amount: number
  reference: string | null
  createdAt: string
}

export interface SaleDetail extends SaleHeader {
  items: SaleItem[]
  payments: SalePayment[]
  laterPayments: Array<{ paymentId: string; code: string; paymentDate: string; method: string; amount: number }>
  returns: Array<{ id: string; code: string; returnDate: string; totalValue: number; refundAmount: number }>
}

export interface SaleCreatedResult {
  sale: SaleDetail
  changeDue: number
  creditApplied: number
}

export interface SaleReturn {
  id: string
  code: string
  saleId: string
  saleCode: string
  branchId: string
  customerName: string | null
  returnDate: string
  reason: string | null
  totalValue: number
  taxReversed: number
  costReversed?: number
  appliedToBalance: number
  refundAmount: number
  refundMethod: string | null
  processedByName: string | null
  createdAt: string
  items?: Array<{ saleItemId: string; productName: string; variantName: string | null; quantity: number; lineValue: number; restock: boolean }>
}

export interface QuotationItem {
  id: string
  variantId: string
  productId: string
  productName: string
  variantName: string | null
  quantity: number
  unitPrice: number
  discount: number
  lineTotal: number
}

export interface Quotation {
  id: string
  code: string
  branchId: string
  branchName: string
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  quoteDate: string
  validUntil: string | null
  subtotal: number
  discountTotal: number
  taxRateBps: number
  taxAmount: number
  total: number
  status: "draft" | "sent" | "accepted" | "converted" | "expired" | "cancelled"
  notes: string | null
  terms: string | null
  convertedSaleId: string | null
  createdByName: string | null
  createdAt: string
  items?: QuotationItem[]
}

export interface CashReconciliation {
  id: string
  branchId: string
  branchName: string
  accountId: string
  accountName: string
  reconDate: string
  expectedAmount: number
  countedAmount: number
  difference: number
  notes: string | null
  adjustmentPosted: boolean
  closedByName: string | null
  createdAt: string
}

export interface CashupPreview {
  date: string
  branchId: string
  accountId: string
  accountName: string
  openingBalance: number
  cashIn: number
  cashOut: number
  expectedAmount: number
  alreadyClosed: CashReconciliation | null
}

export interface DailySalesSummary {
  date: string
  branchId: string | null
  sales: {
    salesCount: number
    totalSales: number
    netSales: number
    discountTotal: number
    taxAmount: number
    amountPaid: number
    balanceDue: number
    costOfGoods?: number
    grossProfit?: number
  }
  returns: { count: number; value: number; tax: number; cost: number; refunded: number }
  moneyReceived: Array<{ method: string; count: number; total: number }>
  totalReceived: number
  expensesPaid: Array<{ method: string; count: number; total: number }>
  topItems: Array<{ variantId: string; productName: string; variantName: string | null; sku: string; quantity: number; revenue: number; cost?: number }>
  bySeller: Array<{ soldById: string; soldByName: string; salesCount: number; totalSales: number; netSales: number; returned: number; commission: number }>
}
