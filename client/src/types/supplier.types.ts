export interface Supplier {
  id: string
  code: string
  type: "supplier" | "vendor"
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  category: string | null
  bankName: string | null
  bankAccountNumber: string | null
  bankAccountName: string | null
  paymentTermsDays: number | null
  notes: string | null
  isActive: boolean
  createdAt: string
  totalSupplied: number
  totalPaid: number
  balance: number
  overdueAmount: number
  lastSupplyDate: string | null
}

export interface SupplierLedgerEntry {
  date: string
  type: "supply" | "payment"
  id: string
  reference: string
  description: string
  supplied: number
  paid: number
  balance: number
  createdAt: string
}

export interface SupplierStatement {
  supplier: Supplier
  from: string
  to: string
  openingBalance: number
  totalSupplied: number
  totalPaid: number
  closingBalance: number
  entries: SupplierLedgerEntry[]
}

export interface DueSupply {
  supplyId: string
  code: string
  supplierId: string
  supplierName: string
  invoiceNumber: string | null
  supplyDate: string
  dueDate: string
  totalCost: number
  amountPaid: number
  outstanding: number
  daysOverdue: number
}

export interface PayablesSummary {
  totalOutstanding: number
  overdueAmount: number
  overdueCount: number
  dueSoonAmount: number
  dueSoonCount: number
  creditBalances: number
  topSuppliers: Array<{ supplierId: string; name: string; type: string; supplied: number; balance: number }>
  overdue: DueSupply[]
  dueSoon: DueSupply[]
}

export interface SupplyListItem {
  id: string
  code: string
  supplierId: string
  supplierName: string
  supplierType: string
  branchId: string
  branchName: string
  invoiceNumber: string | null
  supplyDate: string
  dueDate: string | null
  totalCost: number
  amountPaid: number
  outstanding: number
  paymentStatus: "paid" | "part_paid" | "credit"
  isOverdue: boolean
  itemCount: number
  createdByName: string | null
  createdAt: string
}

export interface SupplyDetail extends SupplyListItem {
  subtotal: number
  discount: number
  notes: string | null
  items: Array<{
    id: string
    variantId: string | null
    productId: string | null
    description: string
    sku: string | null
    quantity: number
    unitCost: number
    totalCost: number
  }>
  payments: Array<{
    paymentId: string
    paymentCode: string
    paymentDate: string
    method: string
    amount: number
  }>
}

export interface SupplierPayment {
  id: string
  code: string
  supplierId: string
  supplierName: string
  supplierType: string
  branchId: string | null
  paymentDate: string
  amount: number
  method: string
  accountId: string
  accountName: string
  reference: string | null
  notes: string | null
  proofUrl: string | null
  proofPublicId: string | null
  allocatedAmount: number
  isOverpayment: boolean
  overpaidAmount: number
  createdByName: string | null
  createdAt: string
  allocations?: Array<{ supplyId: string; supplyCode: string; invoiceNumber: string | null; supplyDate: string; amount: number }>
}

export interface RecordSupplierPaymentResult {
  payment: SupplierPayment
  warning: string | null
}
