export interface CustomerDTO {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  creditLimit: number | null;
  isActive: boolean;
  createdAt: Date;
}

export interface CustomerBalanceDTO {
  totalPurchases: number;
  purchaseCount: number;
  /** Unpaid balance on sales. */
  outstanding: number;
  /** Unused payment credit held for the customer. */
  credit: number;
  /** outstanding − credit (what the customer owes overall). */
  balance: number;
  overdueAmount: number;
  lastPurchaseAt: Date | null;
}

export type CustomerListItemDTO = CustomerDTO & CustomerBalanceDTO;

export interface CustomerLedgerEntryDTO {
  date: string;
  type: "sale" | "payment" | "return" | "refund";
  id: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  createdAt: Date;
}

export interface DebtorDTO {
  customerId: string;
  code: string;
  name: string;
  phone: string | null;
  balance: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  oldestDueDate: string | null;
}

export interface OpenSaleRow {
  id: string;
  balanceDue: number;
}

export interface CustomerPaymentDTO {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  branchId: string | null;
  paymentDate: string;
  amount: number;
  method: string;
  accountId: string;
  accountName: string;
  reference: string | null;
  notes: string | null;
  allocatedAmount: number;
  unallocated: number;
  createdByName: string | null;
  createdAt: Date;
  allocations?: Array<{ saleId: string; saleCode: string; amount: number }>;
}
