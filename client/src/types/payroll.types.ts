export interface PayLine {
  label: string
  amount: number
}

export interface LoanDeductionLine {
  loanId: string
  code: string
  type: string
  amount: number
}

export interface PayrollRun {
  id: string
  code: string
  branchId: string | null
  branchName: string | null
  frequency: "monthly" | "weekly"
  periodStart: string
  periodEnd: string
  payDate: string
  status: "draft" | "approved" | "paid" | "cancelled"
  totalGross: number
  totalDeductions: number
  totalNet: number
  totalPaid: number
  employeeCount: number
  notes: string | null
  createdByName: string | null
  approvedByName: string | null
  approvedAt: string | null
  createdAt: string
  items?: PayrollItem[]
}

export interface PayrollItem {
  id: string
  runId: string
  employeeId: string
  employeeCode: string
  employeeName: string
  jobTitle: string | null
  basicSalary: number
  allowances: number
  allowanceLines: PayLine[]
  bonus: number
  commission: number
  grossPay: number
  latenessDeduction: number
  absenceDeduction: number
  loanDeduction: number
  advanceDeduction: number
  otherDeductions: number
  deductionLines: PayLine[]
  loanDeductionLines: LoanDeductionLine[]
  totalDeductions: number
  netPay: number
  amountPaid: number
  status: string
  daysLate: number
  daysAbsent: number
  notes: string | null
  payslipId: string | null
}

export interface Payslip {
  id: string
  code: string
  runId: string
  payrollItemId: string
  employeeId: string
  employeeName: string
  snapshot: {
    business: { name: string; address: string | null; phone: string | null }
    currencySymbol: string
    currencyCode: string
    code: string
    runCode: string
    period: string
    payDate: string
    employee: { code: string; name: string; jobTitle: string | null; bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null }
    earnings: PayLine[]
    deductions: PayLine[]
    grossPay: number
    totalDeductions: number
    netPay: number
    amountPaid: number
    payments: Array<{ date: string; method: string; reference: string | null; amount: number }>
    attendance: { daysLate: number; daysAbsent: number }
  }
  createdAt: string
}

export interface EmployeePayLedger {
  employee: { id: string; code: string; name: string; jobTitle: string | null }
  totalEarned: number
  totalPaid: number
  amountOwed: number
  loansOutstanding: number
  advancesOutstanding: number
  entries: Array<{
    date: string
    type: string
    reference: string
    description: string
    earned: number
    paid: number
  }>
}
