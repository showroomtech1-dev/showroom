export interface Customer {
  id: string
  code: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  creditLimit: number | null
  isActive: boolean
  createdAt: string
  totalPurchases: number
  purchaseCount: number
  outstanding: number
  credit: number
  balance: number
  overdueAmount: number
  lastPurchaseAt: string | null
}

export interface CustomerLedgerEntry {
  date: string
  type: "sale" | "payment" | "return" | "refund"
  id: string
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
  createdAt: string
}

export interface CustomerStatement {
  customer: Customer
  from: string
  to: string
  openingBalance: number
  totalDebit: number
  totalCredit: number
  closingBalance: number
  entries: CustomerLedgerEntry[]
}

export interface DebtorRow {
  customerId: string
  code: string
  name: string
  phone: string | null
  balance: number
  current: number
  days1to30: number
  days31to60: number
  days61to90: number
  over90: number
  oldestDueDate: string | null
}

export interface CustomerPayment {
  id: string
  code: string
  customerId: string
  customerName: string
  branchId: string | null
  paymentDate: string
  amount: number
  method: string
  accountId: string
  accountName: string
  reference: string | null
  notes: string | null
  allocatedAmount: number
  unallocated: number
  createdByName: string | null
  createdAt: string
  allocations?: Array<{ saleId: string; saleCode: string; amount: number }>
}

export interface ReceivablesSummary {
  totalOutstanding: number
  overdueAmount: number
  overdueCount: number
  debtorCount: number
  creditHeld: number
}
