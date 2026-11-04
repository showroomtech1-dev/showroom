// Paying salaries on an approved run, issuing payslips, and the per-employee pay ledger.
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import { FileResult } from "../../../shared/http/handler";
import type { Actor } from "../../../shared/types/actor";
import { todayIn } from "../../../shared/utils/dates";
import { formatMoney } from "../../../shared/utils/money";
import { renderPayslip } from "../../../shared/utils/pdf/payslip.pdf";
import { AuditService } from "../../audit/services/audit.service";
import { EmployeeRepository } from "../../employee/repositories/employee.repository";
import { LedgerService } from "../../finance/services/ledger.service";
import { LoanRepository } from "../../loan/repositories/loan.repository";
import { OrganizationService } from "../../organization/services/organization.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import { payPeriodLabel } from "../domain/payCalculator";
import type { PayrollItemDTO, PayrollRunDTO, PayslipSnapshot } from "../dto/payroll.dto";
import { PayrollRepository } from "../repositories/payroll.repository";
import type { PayItemInput, PayRunInput } from "../validators/payroll.schema";
import { PayrollService } from "./payroll.service";

export class PayrollPaymentService {
  static Instance = new PayrollPaymentService();
  private constructor(
    private readonly repo = PayrollRepository.Instance,
    private readonly payroll = PayrollService.Instance,
    private readonly employees = EmployeeRepository.Instance,
    private readonly loans = LoanRepository.Instance,
    private readonly ledger = LedgerService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly organizations = OrganizationService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private async lockPayable(actor: Actor, runId: string, tx: Tx): Promise<PayrollRunDTO> {
    await this.repo.lockRun(runId, tx);
    const run = await this.repo.findRun(actor.organizationId, runId, tx);
    if (!run) throw AppError.notFound("Payroll run not found");
    if (run.status !== "approved") {
      throw AppError.badRequest(run.status === "draft" ? "The owner must approve this payroll before salaries are paid" : `This payroll is ${run.status}`);
    }
    return run;
  }

  private async payOne(
    actor: Actor,
    run: PayrollRunDTO,
    item: PayrollItemDTO,
    pay: { amount: number; method: PayRunInput["method"]; accountId?: string; paymentDate: string; reference?: string | null },
    tx: Tx
  ): Promise<void> {
    await this.repo.lockItem(item.id, tx);
    const employee = await this.employees.findById(actor.organizationId, item.employeeId, tx);
    const accountId = await this.ledger.resolveAccount(actor, { method: pay.method, accountId: pay.accountId, branchId: employee?.branchId }, tx);
    const paymentId = await this.repo.insertPayment(
      { organizationId: actor.organizationId, runId: run.id, payrollItemId: item.id, employeeId: item.employeeId, amount: pay.amount, method: pay.method, accountId, paymentDate: pay.paymentDate, reference: pay.reference ?? null, paidById: actor.id },
      tx
    );
    const paid = Number(item.amountPaid) + pay.amount;
    const fullyPaid = paid >= Number(item.netPay);
    await this.repo.updateItem(item.id, { amountPaid: paid, status: fullyPaid ? "paid" : "partial" }, tx);
    await this.ledger.post(
      actor,
      actor.organizationId,
      { accountId, branchId: employee?.branchId ?? null, date: pay.paymentDate, direction: "out", amount: pay.amount, type: "payroll_payment", referenceType: "payroll_payment", referenceId: paymentId, description: `${run.code} salary — ${item.employeeName}` },
      tx
    );
    if (fullyPaid) await this.issuePayslip(actor, run, { ...item, amountPaid: paid }, tx);
  }

  private async issuePayslip(actor: Actor, run: PayrollRunDTO, item: PayrollItemDTO, tx: Tx): Promise<void> {
    const ctx = await this.organizations.exportContext(actor);
    const employee = await this.employees.findById(actor.organizationId, item.employeeId, tx);
    const code = (await this.repo.payslipCodeForItem(item.id, tx)) ?? (await this.codes.next(actor.organizationId, "payslip", tx));
    const earnings = [
      { label: "Basic salary", amount: Number(item.basicSalary) },
      ...item.allowanceLines,
      ...(Number(item.bonus) > 0 ? [{ label: "Bonus", amount: Number(item.bonus) }] : []),
      ...(Number(item.commission) > 0 ? [{ label: "Sales commission", amount: Number(item.commission) }] : []),
    ];
    const deductions = [
      ...(Number(item.latenessDeduction) > 0 ? [{ label: `Lateness (${item.daysLate} day${item.daysLate === 1 ? "" : "s"})`, amount: Number(item.latenessDeduction) }] : []),
      ...(Number(item.absenceDeduction) > 0 ? [{ label: `Absence (${item.daysAbsent} day${item.daysAbsent === 1 ? "" : "s"})`, amount: Number(item.absenceDeduction) }] : []),
      ...item.loanDeductionLines.map((l) => ({ label: `${l.type === "advance" ? "Salary advance" : "Staff loan"} ${l.code}`, amount: l.amount })),
      ...item.deductionLines,
    ];
    const snapshot: PayslipSnapshot = {
      business: { name: ctx.businessName, address: ctx.businessAddress ?? null, phone: ctx.businessPhone ?? null },
      currencySymbol: ctx.currencySymbol,
      currencyCode: ctx.currencyCode,
      code,
      runCode: run.code,
      period: payPeriodLabel(run.frequency, run.periodStart, run.periodEnd),
      payDate: run.payDate,
      employee: {
        code: item.employeeCode,
        name: item.employeeName,
        jobTitle: item.jobTitle,
        bankName: employee?.bankName ?? null,
        bankAccountNumber: employee?.bankAccountNumber ?? null,
        bankAccountName: employee?.bankAccountName ?? null,
      },
      earnings,
      deductions,
      grossPay: Number(item.grossPay),
      totalDeductions: Number(item.totalDeductions),
      netPay: Number(item.netPay),
      amountPaid: Number(item.amountPaid),
      payments: await this.repo.itemPayments(item.id, tx),
      attendance: { daysLate: item.daysLate, daysAbsent: item.daysAbsent },
    };
    await this.repo.insertPayslip({ organizationId: actor.organizationId, runId: run.id, payrollItemId: item.id, employeeId: item.employeeId, code, snapshot }, tx);
  }

  private async finishRun(runId: string, tx: Tx): Promise<void> {
    await this.repo.refreshTotals(runId, tx);
    const items = await this.repo.items(runId, tx);
    if (items.every((i) => Number(i.amountPaid) >= Number(i.netPay))) await this.repo.updateRun(runId, { status: "paid" }, tx);
  }

  /** Pays everyone (or the chosen employees) the balance of their net pay. */
  async payRun(actor: Actor, runId: string, data: PayRunInput) {
    assertPermission(actor, "payroll.pay");
    const { timezone, currencySymbol } = await this.settings.get(actor.organizationId);
    const paymentDate = data.paymentDate ?? todayIn(timezone);
    await inTransaction(async (tx) => {
      const run = await this.lockPayable(actor, runId, tx);
      const items = (await this.repo.items(runId, tx)).filter((i) => !data.itemIds || data.itemIds.includes(i.id));
      const due = items.filter((i) => Number(i.netPay) - Number(i.amountPaid) > 0);
      if (due.length === 0) throw AppError.badRequest("Everyone selected has already been paid");
      let total = 0;
      for (const item of due) {
        const amount = Number(item.netPay) - Number(item.amountPaid);
        total += amount;
        await this.payOne(actor, run, item, { amount, method: data.method, accountId: data.accountId, paymentDate, reference: data.reference }, tx);
      }
      // Zero-pay lines (fully deducted) still get a payslip.
      for (const item of items.filter((i) => Number(i.netPay) === 0 && !i.payslipId)) {
        await this.repo.updateItem(item.id, { status: "paid" }, tx);
        await this.issuePayslip(actor, run, item, tx);
      }
      await this.finishRun(runId, tx);
      await this.audit.log(actor, { action: "pay", entityType: "payroll_run", entityId: runId, summary: `Paid ${due.length} salary(ies) on ${run.code}: ${formatMoney(total, currencySymbol)}`, after: { method: data.method, paymentDate, total } }, tx);
    });
    return this.payroll.getRun(actor, runId);
  }

  /** Pays one employee — the full balance or a part-payment. */
  async payItem(actor: Actor, runId: string, itemId: string, data: PayItemInput) {
    assertPermission(actor, "payroll.pay");
    const { timezone, currencySymbol } = await this.settings.get(actor.organizationId);
    const paymentDate = data.paymentDate ?? todayIn(timezone);
    await inTransaction(async (tx) => {
      const run = await this.lockPayable(actor, runId, tx);
      const item = await this.repo.findItem(runId, itemId, tx);
      if (!item) throw AppError.notFound("Payroll line not found");
      const balance = Number(item.netPay) - Number(item.amountPaid);
      if (balance <= 0) throw AppError.badRequest(`${item.employeeName} has already been paid in full`);
      const amount = data.amount ?? balance;
      if (amount > balance) throw AppError.badRequest(`Only ${formatMoney(balance, currencySymbol)} is still owed to ${item.employeeName}`);
      await this.payOne(actor, run, item, { amount, method: data.method, accountId: data.accountId, paymentDate, reference: data.reference }, tx);
      await this.finishRun(runId, tx);
      await this.audit.log(actor, { action: "pay", entityType: "payroll_item", entityId: itemId, summary: `Paid ${item.employeeName} ${formatMoney(amount, currencySymbol)} on ${run.code}`, after: { amount, method: data.method, paymentDate } }, tx);
    });
    return this.payroll.getRun(actor, runId);
  }

  listPayslips(actor: Actor, query: { page: number; limit: number; runId?: string; employeeId?: string }) {
    return this.repo.payslips(actor.organizationId, query);
  }

  async payslip(actor: Actor, id: string) {
    const slip = await this.repo.findPayslip(actor.organizationId, id);
    if (!slip) throw AppError.notFound("Payslip not found");
    return slip;
  }

  async payslipPdf(actor: Actor, id: string): Promise<FileResult> {
    const slip = await this.payslip(actor, id);
    return new FileResult(`payslip-${slip.code}.pdf`, "application/pdf", await renderPayslip(slip.snapshot), true);
  }

  /** Amount paid, amount still owed and loans/advances outstanding for one employee. */
  async employeeLedger(actor: Actor, employeeId: string) {
    const employee = await this.employees.findById(actor.organizationId, employeeId);
    if (!employee) throw AppError.notFound("Employee not found");
    const [totals, outstanding, entries] = await Promise.all([
      this.repo.employeeTotals(employeeId),
      this.loans.outstandingForEmployee(employeeId),
      this.repo.employeeLedger(employeeId),
    ]);
    return {
      employee: { id: employee.id, code: employee.code, name: employee.fullName, jobTitle: employee.jobTitle },
      totalEarned: totals.earned,
      totalPaid: totals.paid,
      amountOwed: totals.owed,
      loansOutstanding: outstanding.loans,
      advancesOutstanding: outstanding.advances,
      entries,
    };
  }
}
