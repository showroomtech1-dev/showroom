// One employee's line on a payroll run ("payroll" in the requirements).
import { EntitySchema } from "typeorm";
import {
  createdAt,
  intColumn,
  jsonColumn,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";
import type { LoanDeductionLine, PayLine } from "../domain/payCalculator";

export type { LoanDeductionLine, PayLine };

export interface PayrollItem {
  id: string;
  organizationId: string;
  runId: string;
  employeeId: string;
  basicSalary: number;
  allowances: number;
  allowanceLines: PayLine[];
  bonus: number;
  commission: number;
  grossPay: number;
  latenessDeduction: number;
  absenceDeduction: number;
  loanDeduction: number;
  advanceDeduction: number;
  otherDeductions: number;
  deductionLines: PayLine[];
  loanDeductionLines: LoanDeductionLine[];
  totalDeductions: number;
  netPay: number;
  amountPaid: number;
  status: string;
  daysLate: number;
  daysAbsent: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  run?: { id: string };
  employee?: { id: string };
}

export const PayrollItemEntity = new EntitySchema<PayrollItem>({
  name: "PayrollItem",
  tableName: "payroll_items",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    runId: uuidColumn("run_id"),
    employeeId: uuidColumn("employee_id"),
    basicSalary: moneyColumn("basic_salary"),
    allowances: moneyColumn("allowances"),
    allowanceLines: { ...jsonColumn("allowance_lines", false), default: () => "'[]'" },
    bonus: moneyColumn("bonus"),
    commission: moneyColumn("commission"),
    grossPay: moneyColumn("gross_pay"),
    latenessDeduction: moneyColumn("lateness_deduction"),
    absenceDeduction: moneyColumn("absence_deduction"),
    loanDeduction: moneyColumn("loan_deduction"),
    advanceDeduction: moneyColumn("advance_deduction"),
    otherDeductions: moneyColumn("other_deductions"),
    deductionLines: { ...jsonColumn("deduction_lines", false), default: () => "'[]'" },
    loanDeductionLines: { ...jsonColumn("loan_deduction_lines", false), default: () => "'[]'" },
    totalDeductions: moneyColumn("total_deductions"),
    netPay: moneyColumn("net_pay"),
    amountPaid: moneyColumn("amount_paid"),
    status: varchar("status", 10, false, "pending"),
    daysLate: intColumn("days_late", 0),
    daysAbsent: intColumn("days_absent", 0),
    notes: textColumn("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  relations: {
    run: manyToOne("PayrollRun", "run_id", "CASCADE"),
    employee: manyToOne("Employee", "employee_id"),
  },
  indices: [
    { name: "UQ_payroll_items_run_employee", columns: ["runId", "employeeId"], unique: true },
    { name: "IDX_payroll_items_employee", columns: ["employeeId"] },
  ],
  checks: [{ name: "CHK_payroll_items_paid", expression: `"amount_paid" >= 0 AND "amount_paid" <= GREATEST("net_pay", 0)` }],
});
