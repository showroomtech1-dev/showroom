import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Expense {
  id: string;
  organizationId: string;
  branchId: string;
  code: string;
  expenseDate: string;
  categoryId: string;
  amount: number;
  method: string;
  accountId: string;
  payee: string | null;
  /** Optional link to a vendor record. */
  supplierId: string | null;
  description: string | null;
  receiptUrl: string | null;
  receiptPublicId: string | null;
  recurringExpenseId: string | null;
  clientRef: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  category?: { id: string };
  account?: { id: string };
  supplier?: { id: string };
  recurringExpense?: { id: string };
}

export const ExpenseEntity = new EntitySchema<Expense>({
  name: "Expense",
  tableName: "expenses",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    code: varchar("code", 24),
    expenseDate: dateColumn("expense_date"),
    categoryId: uuidColumn("category_id"),
    amount: moneyColumn("amount"),
    method: varchar("method", 10),
    accountId: uuidColumn("account_id"),
    payee: varchar("payee", 160, true),
    supplierId: uuidColumn("supplier_id", true),
    description: textColumn("description"),
    receiptUrl: varchar("receipt_url", 500, true),
    receiptPublicId: varchar("receipt_public_id", 255, true),
    recurringExpenseId: uuidColumn("recurring_expense_id", true),
    clientRef: varchar("client_ref", 64, true),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    category: manyToOne("ExpenseCategory", "category_id"),
    account: manyToOne("Account", "account_id"),
    supplier: manyToOne("Supplier", "supplier_id", "SET NULL"),
    recurringExpense: manyToOne("RecurringExpense", "recurring_expense_id", "SET NULL"),
  },
  indices: [
    { name: "IDX_expenses_org_date", columns: ["organizationId", "expenseDate"] },
    { name: "IDX_expenses_org_category_date", columns: ["organizationId", "categoryId", "expenseDate"] },
    { name: "IDX_expenses_org_supplier", columns: ["organizationId", "supplierId"] },
    { name: "UQ_expenses_org_code", columns: ["organizationId", "code"], unique: true },
    { name: "UQ_expenses_client_ref", columns: ["organizationId", "clientRef"], unique: true, where: "client_ref IS NOT NULL" },
  ],
  checks: [{ name: "CHK_expenses_amount", expression: `"amount" > 0` }],
});
