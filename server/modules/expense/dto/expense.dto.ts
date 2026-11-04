export interface ExpenseCategoryDTO {
  id: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  expenseCount: number;
}

export interface ExpenseDTO {
  id: string;
  code: string;
  branchId: string;
  branchName: string;
  expenseDate: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  method: string;
  accountId: string;
  accountName: string;
  payee: string | null;
  supplierId: string | null;
  supplierName: string | null;
  description: string | null;
  receiptUrl: string | null;
  receiptPublicId: string | null;
  recurringExpenseId: string | null;
  createdByName: string | null;
  createdAt: Date;
}

export interface RecurringExpenseDTO {
  id: string;
  branchId: string;
  branchName: string;
  categoryId: string;
  categoryName: string;
  name: string;
  amount: number;
  method: string;
  accountId: string | null;
  payee: string | null;
  supplierId: string | null;
  frequency: string;
  startDate: string;
  nextDueDate: string;
  endDate: string | null;
  isActive: boolean;
  lastRecordedAt: Date | null;
  notes: string | null;
  daysUntilDue: number;
}

export interface ExpenseGroupRow {
  key: string;
  label: string;
  count: number;
  total: number;
}
