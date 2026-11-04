import type { AccountType, LedgerType, PaymentMethod } from "../../../config/constants";

export interface AccountDTO {
  id: string;
  branchId: string | null;
  branchName: string | null;
  name: string;
  type: AccountType;
  bankName: string | null;
  accountNumber: string | null;
  openingBalance: number;
  balance: number;
  isDefault: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface AccountOptionDTO {
  id: string;
  name: string;
  type: AccountType;
  branchId: string | null;
  isDefault: boolean;
}

export interface LedgerEntryInput {
  accountId: string;
  branchId?: string | null;
  date: string;
  direction: "in" | "out";
  amount: number;
  type: LedgerType;
  referenceType?: string | null;
  referenceId?: string | null;
  description: string;
}

export interface LedgerRowDTO {
  id: string;
  transactionDate: string;
  direction: "in" | "out";
  amount: number;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string;
  createdByName: string | null;
  runningBalance: number;
  createdAt: Date;
}

export interface AccountStatementDTO {
  account: AccountDTO;
  from: string;
  to: string;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
  rows: LedgerRowDTO[];
}

export interface PaymentTarget {
  method: PaymentMethod;
  accountId?: string | null;
  branchId?: string | null;
}

export interface TransferDTO {
  id: string;
  code: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  transferDate: string;
  reference: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: Date;
}
