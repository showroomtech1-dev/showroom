// Pure payroll maths (no I/O). Gross = basic + allowances + bonus + commission.
// Deductions = lateness + absence + loan/advance repayments + other. Net pay is never negative:
// when deductions exceed gross they are trimmed in this order — loan/advance repayments first
// (they simply carry over to the next run), then other deductions, absence, lateness.
export interface PayLine {
  label: string;
  amount: number;
}

export interface LoanDeductionLine {
  loanId: string;
  code: string;
  type: string;
  amount: number;
}

export interface PayInputs {
  basicSalary: number;
  allowanceLines: PayLine[];
  bonus: number;
  commission: number;
  latenessDeduction: number;
  absenceDeduction: number;
  deductionLines: PayLine[];
  loanDeductionLines: LoanDeductionLine[];
}

export interface PayResult extends PayInputs {
  allowances: number;
  grossPay: number;
  loanDeduction: number;
  advanceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
}

const sum = (lines: Array<{ amount: number }>) => lines.reduce((s, l) => s + l.amount, 0);

export function computePay(input: PayInputs): PayResult {
  const allowances = sum(input.allowanceLines);
  const grossPay = input.basicSalary + allowances + input.bonus + input.commission;

  const loanLines = input.loanDeductionLines.map((l) => ({ ...l }));
  const otherLines = input.deductionLines.map((l) => ({ ...l }));
  let lateness = input.latenessDeduction;
  let absence = input.absenceDeduction;

  let excess = lateness + absence + sum(otherLines) + sum(loanLines) - grossPay;
  const trim = (current: number): number => {
    if (excess <= 0) return current;
    const cut = Math.min(current, excess);
    excess -= cut;
    return current - cut;
  };
  // Trim loan repayments before advance repayments: an advance is meant to be cleared in one run.
  for (const line of [...loanLines.filter((l) => l.type === "loan"), ...loanLines.filter((l) => l.type !== "loan")]) line.amount = trim(line.amount);
  for (const line of otherLines) line.amount = trim(line.amount);
  absence = trim(absence);
  lateness = trim(lateness);

  const keptLoanLines = loanLines.filter((l) => l.amount > 0);
  const loanDeduction = sum(keptLoanLines.filter((l) => l.type === "loan"));
  const advanceDeduction = sum(keptLoanLines.filter((l) => l.type !== "loan"));
  const otherDeductions = sum(otherLines);
  const totalDeductions = lateness + absence + loanDeduction + advanceDeduction + otherDeductions;

  return {
    ...input,
    latenessDeduction: lateness,
    absenceDeduction: absence,
    deductionLines: otherLines.filter((l) => l.amount > 0),
    loanDeductionLines: keptLoanLines,
    allowances,
    grossPay,
    loanDeduction,
    advanceDeduction,
    otherDeductions,
    totalDeductions,
    netPay: grossPay - totalDeductions,
  };
}

/** Weekly staff on a monthly-style salary input are paid per period as entered; no pro-rating. */
export function payPeriodLabel(frequency: string, start: string, end: string): string {
  return frequency === "weekly" ? `Week ${start} – ${end}` : `${start.slice(0, 7)} (${start} – ${end})`;
}
