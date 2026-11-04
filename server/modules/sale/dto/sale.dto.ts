export interface SaleHeaderDTO {
  id: string;
  code: string;
  branchId: string;
  branchName: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  soldById: string;
  soldByName: string;
  soldAt: Date;
  status: "completed" | "voided";
  subtotal: number;
  discountTotal: number;
  taxRateBps: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: "paid" | "part_paid" | "credit";
  dueDate: string | null;
  costTotal?: number;
  commissionRateBps: number;
  commissionAmount: number;
  returnedAmount: number;
  notes: string | null;
  receiptToken: string;
  quotationId: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  itemCount: number;
  createdAt: Date;
}

export interface SaleItemDTO {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  listPrice: number;
  discount: number;
  lineTotal: number;
  unitCost?: number;
  returnedQuantity: number;
}

export interface SalePaymentDTO {
  id: string;
  method: string;
  accountId: string;
  accountName: string;
  amount: number;
  reference: string | null;
  createdAt: Date;
}

export interface SaleDetailDTO extends SaleHeaderDTO {
  items: SaleItemDTO[];
  payments: SalePaymentDTO[];
  laterPayments: Array<{ paymentId: string; code: string; paymentDate: string; method: string; amount: number }>;
  returns: Array<{ id: string; code: string; returnDate: string; totalValue: number; refundAmount: number }>;
}

export interface SaleCreatedDTO {
  sale: SaleDetailDTO;
  /** Cash to hand back when the customer paid more than the total. */
  changeDue: number;
  /** Customer credit (from earlier over-payments) applied to this sale. */
  creditApplied: number;
}

export interface SaleReturnDTO {
  id: string;
  code: string;
  saleId: string;
  saleCode: string;
  branchId: string;
  customerName: string | null;
  returnDate: string;
  reason: string | null;
  totalValue: number;
  taxReversed: number;
  costReversed?: number;
  appliedToBalance: number;
  refundAmount: number;
  refundMethod: string | null;
  processedByName: string | null;
  createdAt: Date;
  items?: Array<{ saleItemId: string; productName: string; variantName: string | null; quantity: number; lineValue: number; restock: boolean }>;
}

export interface CashReconciliationDTO {
  id: string;
  branchId: string;
  branchName: string;
  accountId: string;
  accountName: string;
  reconDate: string;
  expectedAmount: number;
  countedAmount: number;
  difference: number;
  notes: string | null;
  adjustmentPosted: boolean;
  closedByName: string | null;
  createdAt: Date;
}
