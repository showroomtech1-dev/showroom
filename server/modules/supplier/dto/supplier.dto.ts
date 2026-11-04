export interface SupplierDTO {
  id: string;
  code: string;
  type: "supplier" | "vendor";
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  paymentTermsDays: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface SupplierBalanceDTO {
  totalSupplied: number;
  totalPaid: number;
  /** What the business owes (negative = supplier holds a credit / over-payment). */
  balance: number;
  overdueAmount: number;
  lastSupplyDate: string | null;
}

export type SupplierListItemDTO = SupplierDTO & SupplierBalanceDTO;

export interface SupplierLedgerEntryDTO {
  date: string;
  type: "supply" | "payment";
  id: string;
  reference: string;
  description: string;
  supplied: number;
  paid: number;
  balance: number;
  createdAt: Date;
}

export interface SupplierStatementDTO {
  supplier: SupplierDTO;
  from: string;
  to: string;
  openingBalance: number;
  totalSupplied: number;
  totalPaid: number;
  closingBalance: number;
  entries: SupplierLedgerEntryDTO[];
}

export interface DueSupplyDTO {
  supplyId: string;
  code: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string | null;
  supplyDate: string;
  dueDate: string;
  totalCost: number;
  amountPaid: number;
  outstanding: number;
  daysOverdue: number;
}

export interface PayablesSummaryDTO {
  totalOutstanding: number;
  overdueAmount: number;
  overdueCount: number;
  dueSoonAmount: number;
  dueSoonCount: number;
  creditBalances: number;
  topSuppliers: Array<{ supplierId: string; name: string; type: string; supplied: number; balance: number }>;
  overdue: DueSupplyDTO[];
  dueSoon: DueSupplyDTO[];
}
