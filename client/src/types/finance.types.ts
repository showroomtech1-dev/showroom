export type AccountType = "cash" | "bank" | "pos"
export type PaymentMethod = "cash" | "transfer" | "pos" | "cheque"

export interface Account {
  id: string
  branchId: string | null
  branchName: string | null
  name: string
  type: AccountType
  bankName: string | null
  accountNumber: string | null
  openingBalance: number
  balance: number
  isDefault: boolean
  isActive: boolean
  notes: string | null
  createdAt: string
}

export interface AccountOption {
  id: string
  name: string
  type: AccountType
  branchId: string | null
  isDefault: boolean
}

export interface LedgerRow {
  id: string
  transactionDate: string
  direction: "in" | "out"
  amount: number
  type: string
  referenceType: string | null
  referenceId: string | null
  description: string
  createdByName: string | null
  runningBalance: number
  createdAt: string
}

export interface AccountStatement {
  account: Account
  from: string
  to: string
  openingBalance: number
  totalIn: number
  totalOut: number
  closingBalance: number
  rows: LedgerRow[]
}

export interface AccountTransfer {
  id: string
  code: string
  fromAccountId: string
  fromAccountName: string
  toAccountId: string
  toAccountName: string
  amount: number
  transferDate: string
  reference: string | null
  notes: string | null
  createdByName: string | null
  createdAt: string
}

export interface ProfitAndLoss {
  from: string
  to: string
  branchId: string | null
  revenue: { salesExcludingTax: number; returns: number; discountsGiven: number; total: number; salesCount: number }
  costOfGoodsSold: number
  grossProfit: number
  grossMarginBps: number
  expenses: {
    byCategory: Array<{ category: string; amount: number }>
    vendorBills: number
    payroll: number
    total: number
  }
  netProfit: number
  netMarginBps: number
  tax: { name: string; collected: number }
}

export interface CashFlow {
  from: string
  to: string
  branchId: string | null
  openingBalance: number | null
  inflows: Array<{ type: string; direction: "in"; amount: number; label: string }>
  outflows: Array<{ type: string; direction: "out"; amount: number; label: string }>
  totalIn: number
  totalOut: number
  netCashFlow: number
  closingBalance: number | null
}

export interface PayablesReceivables {
  payables: {
    totalOutstanding: number
    overdueAmount: number
    overdueCount: number
    dueSoonAmount: number
    supplierCredit: number
    topSuppliers: Array<{ supplierId: string; name: string; type: string; supplied: number; balance: number }>
  }
  receivables: {
    totalOutstanding: number
    overdueAmount: number
    overdueCount: number
    debtorCount: number
    creditHeld: number
    aging: { current: number; days1to30: number; days31to60: number; days61to90: number; over90: number } | null
    topDebtors: Array<{ customerId: string; code: string; name: string; phone: string | null; balance: number }>
  }
}
