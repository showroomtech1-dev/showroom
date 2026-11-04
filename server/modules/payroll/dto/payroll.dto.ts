import type { LoanDeductionLine, PayLine } from "../domain/payCalculator";

export interface PayrollRunDTO {
  id: string;
  code: string;
  branchId: string | null;
  branchName: string | null;
  frequency: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalPaid: number;
  employeeCount: number;
  notes: string | null;
  createdByName: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

export interface PayrollItemDTO {
  id: string;
  runId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  jobTitle: string | null;
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
  payslipId: string | null;
}

export interface PayslipSnapshot {
  [key: string]: unknown;
  business: { name: string; address: string | null; phone: string | null };
  currencySymbol: string;
  currencyCode: string;
  code: string;
  runCode: string;
  period: string;
  payDate: string;
  employee: { code: string; name: string; jobTitle: string | null; bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null };
  earnings: PayLine[];
  deductions: PayLine[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  amountPaid: number;
  payments: Array<{ date: string; method: string; reference: string | null; amount: number }>;
  attendance: { daysLate: number; daysAbsent: number };
}

export interface PayslipDTO {
  id: string;
  code: string;
  runId: string;
  payrollItemId: string;
  employeeId: string;
  employeeName: string;
  snapshot: PayslipSnapshot;
  createdAt: Date;
}
