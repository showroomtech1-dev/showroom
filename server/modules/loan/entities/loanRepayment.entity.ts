import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  manyToOne,
  moneyColumn,
  primaryId,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface LoanRepayment {
  id: string;
  organizationId: string;
  loanId: string;
  payrollItemId: string | null;
  amount: number;
  repaymentDate: string;
  /** "payroll" (deducted from salary) or "manual" (paid back in cash/transfer). */
  source: string;
  method: string | null;
  accountId: string | null;
  createdById: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  loan?: { id: string };
}

export const LoanRepaymentEntity = new EntitySchema<LoanRepayment>({
  name: "LoanRepayment",
  tableName: "loan_repayments",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    loanId: uuidColumn("loan_id"),
    payrollItemId: uuidColumn("payroll_item_id", true),
    amount: moneyColumn("amount"),
    repaymentDate: dateColumn("repayment_date"),
    source: varchar("source", 10),
    method: varchar("method", 10, true),
    accountId: uuidColumn("account_id", true),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  relations: { loan: manyToOne("Loan", "loan_id", "CASCADE") },
  indices: [
    { name: "IDX_loan_repayments_loan", columns: ["loanId"] },
    { name: "IDX_loan_repayments_item", columns: ["payrollItemId"] },
  ],
  checks: [{ name: "CHK_loan_repayments_amount", expression: `"amount" > 0` }],
});
