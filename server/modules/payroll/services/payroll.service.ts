// Payroll lifecycle: draft (generated + edited) → approved (owner; loan deductions committed)
// → paid (payments recorded, payslips issued). A run can be cancelled before any payment.
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { formatMoney } from "../../../shared/utils/money";
import { AuditService } from "../../audit/services/audit.service";
import type { PayrollEmployeeRow } from "../../employee/dto/employee.dto";
import { AttendanceRepository } from "../../employee/repositories/attendance.repository";
import { EmployeeRepository } from "../../employee/repositories/employee.repository";
import { LoanRepository } from "../../loan/repositories/loan.repository";
import type { SettingsDTO } from "../../organization/dto/organization.dto";
import { BranchService } from "../../organization/services/branch.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import { SaleReportRepository } from "../../sale/repositories/saleReport.repository";
import { computePay, type LoanDeductionLine, type PayLine } from "../domain/payCalculator";
import type { PayrollItemDTO, PayrollRunDTO } from "../dto/payroll.dto";
import { PayrollRepository } from "../repositories/payroll.repository";
import type { CreateRunInput, ListRunsQuery, UpdateItemInput } from "../validators/payroll.schema";

export class PayrollService {
  static Instance = new PayrollService();
  private constructor(
    private readonly repo = PayrollRepository.Instance,
    private readonly employees = EmployeeRepository.Instance,
    private readonly attendance = AttendanceRepository.Instance,
    private readonly loans = LoanRepository.Instance,
    private readonly salesReports = SaleReportRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  listRuns(actor: Actor, query: ListRunsQuery) {
    return this.repo.listRuns(actor.organizationId, query);
  }

  async getRun(actor: Actor, id: string, tx?: Tx): Promise<PayrollRunDTO & { items: PayrollItemDTO[] }> {
    const run = await this.repo.findRun(actor.organizationId, id, tx);
    if (!run) throw AppError.notFound("Payroll run not found");
    return { ...run, items: await this.repo.items(id, tx) };
  }

  /** Automatic parts of one employee's pay: commission, attendance deductions and loan repayments. */
  private async autoParts(actor: Actor, settings: SettingsDTO, run: { periodStart: string; periodEnd: string }, employee: { id: string; userId: string | null }, tx: Tx) {
    const [att] = await this.attendance.summary(actor.organizationId, run.periodStart, run.periodEnd, null, [employee.id], tx);
    const daysLate = att?.late ?? 0;
    const daysAbsent = att?.absent ?? 0;
    let commission = 0;
    if (employee.userId && settings.commissionEnabled) {
      const [seller] = await this.salesReports.bySeller({
        organizationId: actor.organizationId,
        branchId: null,
        from: run.periodStart,
        to: run.periodEnd,
        timezone: settings.timezone,
        soldById: employee.userId,
      });
      commission = seller?.commission ?? 0;
    }
    const loanLines: LoanDeductionLine[] = (await this.loans.activeForEmployeeForUpdate(employee.id, tx))
      .map((l) => ({ loanId: l.id, code: l.code, type: l.type, amount: Math.min(Number(l.installmentAmount), Number(l.outstanding)) }))
      .filter((l) => l.amount > 0);
    return {
      daysLate,
      daysAbsent,
      commission,
      latenessDeduction: settings.lateDeductionEnabled ? daysLate * settings.latenessDeduction : 0,
      absenceDeduction: daysAbsent * settings.absenceDeduction,
      loanLines,
    };
  }

  private async insertItemFor(actor: Actor, settings: SettingsDTO, runId: string, run: { periodStart: string; periodEnd: string }, e: PayrollEmployeeRow, tx: Tx): Promise<void> {
    const auto = await this.autoParts(actor, settings, run, e, tx);
    const pay = computePay({
      basicSalary: e.salary,
      allowanceLines: [],
      bonus: 0,
      commission: auto.commission,
      latenessDeduction: auto.latenessDeduction,
      absenceDeduction: auto.absenceDeduction,
      deductionLines: [],
      loanDeductionLines: auto.loanLines,
    });
    await this.repo.insertItem(
      {
        organizationId: actor.organizationId,
        runId,
        employeeId: e.id,
        basicSalary: pay.basicSalary,
        allowances: pay.allowances,
        allowanceLines: pay.allowanceLines,
        bonus: pay.bonus,
        commission: pay.commission,
        grossPay: pay.grossPay,
        latenessDeduction: pay.latenessDeduction,
        absenceDeduction: pay.absenceDeduction,
        loanDeduction: pay.loanDeduction,
        advanceDeduction: pay.advanceDeduction,
        otherDeductions: pay.otherDeductions,
        deductionLines: pay.deductionLines,
        loanDeductionLines: pay.loanDeductionLines,
        totalDeductions: pay.totalDeductions,
        netPay: pay.netPay,
        amountPaid: 0,
        status: "pending",
        daysLate: auto.daysLate,
        daysAbsent: auto.daysAbsent,
        notes: null,
      },
      tx
    );
  }

  async createRun(actor: Actor, data: CreateRunInput) {
    assertPermission(actor, "payroll.manage");
    const settings = await this.settings.get(actor.organizationId);
    const branchId = data.branchId ? await this.branches.resolveForWrite(actor, data.branchId) : null;
    const clash = await this.repo.overlappingRun(actor.organizationId, data.frequency, data.periodStart, data.periodEnd, branchId);
    if (clash) throw AppError.conflict(`Payroll run ${clash} already covers part of this period`);
    const id = await inTransaction(async (tx) => {
      const staff = await this.employees.forPayroll(actor.organizationId, data.frequency, data.periodStart, data.periodEnd, branchId, tx);
      if (staff.length === 0) throw AppError.badRequest(`No active ${data.frequency} employees to pay for this period`);
      const code = await this.codes.next(actor.organizationId, "payrollRun", tx);
      const runId = await this.repo.createRun(
        {
          organizationId: actor.organizationId,
          branchId,
          code,
          frequency: data.frequency,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          payDate: data.payDate,
          status: "draft",
          totalGross: 0,
          totalDeductions: 0,
          totalNet: 0,
          totalPaid: 0,
          notes: data.notes ?? null,
          createdById: actor.id,
          approvedById: null,
          approvedAt: null,
        },
        tx
      );
      for (const employee of staff) await this.insertItemFor(actor, settings, runId, data, employee, tx);
      await this.repo.refreshTotals(runId, tx);
      await this.audit.log(actor, { action: "create", entityType: "payroll_run", entityId: runId, summary: `Prepared payroll ${code} for ${staff.length} employee(s), ${data.periodStart} – ${data.periodEnd}` }, tx);
      return runId;
    });
    return this.getRun(actor, id);
  }

  private async lockDraft(actor: Actor, id: string, tx: Tx): Promise<PayrollRunDTO> {
    await this.repo.lockRun(id, tx);
    const run = await this.repo.findRun(actor.organizationId, id, tx);
    if (!run) throw AppError.notFound("Payroll run not found");
    if (run.status !== "draft") throw AppError.badRequest("Only a draft payroll can be changed");
    return run;
  }

  /** Re-reads attendance, commissions and loans for every employee, keeping manual allowances/bonuses/deductions. */
  async recalculate(actor: Actor, id: string) {
    assertPermission(actor, "payroll.manage");
    const settings = await this.settings.get(actor.organizationId);
    await inTransaction(async (tx) => {
      const run = await this.lockDraft(actor, id, tx);
      for (const item of await this.repo.items(id, tx)) {
        const employee = await this.employees.findById(actor.organizationId, item.employeeId, tx);
        const auto = await this.autoParts(actor, settings, run, { id: item.employeeId, userId: employee?.userId ?? null }, tx);
        await this.saveItem(item, { basicSalary: employee?.salary ?? item.basicSalary, commission: auto.commission, latenessDeduction: auto.latenessDeduction, absenceDeduction: auto.absenceDeduction, loanDeductionLines: auto.loanLines, daysLate: auto.daysLate, daysAbsent: auto.daysAbsent }, tx);
      }
      await this.repo.refreshTotals(id, tx);
    });
    return this.getRun(actor, id);
  }

  private async saveItem(
    item: PayrollItemDTO,
    patch: Partial<{ basicSalary: number; allowanceLines: PayLine[]; bonus: number; commission: number; latenessDeduction: number; absenceDeduction: number; deductionLines: PayLine[]; loanDeductionLines: LoanDeductionLine[]; daysLate: number; daysAbsent: number; notes: string | null }>,
    tx: Tx
  ): Promise<void> {
    const pay = computePay({
      basicSalary: patch.basicSalary ?? Number(item.basicSalary),
      allowanceLines: patch.allowanceLines ?? item.allowanceLines,
      bonus: patch.bonus ?? Number(item.bonus),
      commission: patch.commission ?? Number(item.commission),
      latenessDeduction: patch.latenessDeduction ?? Number(item.latenessDeduction),
      absenceDeduction: patch.absenceDeduction ?? Number(item.absenceDeduction),
      deductionLines: patch.deductionLines ?? item.deductionLines,
      loanDeductionLines: patch.loanDeductionLines ?? item.loanDeductionLines,
    });
    const { allowanceLines, deductionLines, loanDeductionLines, ...figures } = pay;
    await this.repo.updateItem(
      item.id,
      { ...figures, allowanceLines, deductionLines, loanDeductionLines, ...(patch.daysLate !== undefined ? { daysLate: patch.daysLate, daysAbsent: patch.daysAbsent } : {}), ...(patch.notes !== undefined ? { notes: patch.notes } : {}) },
      tx
    );
  }

  async updateItem(actor: Actor, runId: string, itemId: string, data: UpdateItemInput) {
    assertPermission(actor, "payroll.manage");
    await inTransaction(async (tx) => {
      await this.lockDraft(actor, runId, tx);
      const item = await this.repo.findItem(runId, itemId, tx);
      if (!item) throw AppError.notFound("Payroll line not found");
      let loanLines: LoanDeductionLine[] | undefined;
      if (data.loanDeductions) {
        const active = new Map((await this.loans.activeForEmployeeForUpdate(item.employeeId, tx)).map((l) => [l.id, l]));
        loanLines = data.loanDeductions.map((d) => {
          const loan = active.get(d.loanId);
          if (!loan) throw AppError.badRequest("That loan is not active for this employee");
          if (d.amount > Number(loan.outstanding)) throw AppError.badRequest(`Only ${loan.outstanding} is still owed on ${loan.code}`);
          return { loanId: loan.id, code: loan.code, type: loan.type, amount: d.amount };
        });
      }
      await this.saveItem(item, { allowanceLines: data.allowanceLines, bonus: data.bonus, deductionLines: data.deductionLines, loanDeductionLines: loanLines, notes: data.notes }, tx);
      await this.repo.refreshTotals(runId, tx);
      await this.audit.log(actor, { action: "update", entityType: "payroll_item", entityId: itemId, summary: `Adjusted pay for ${item.employeeName}`, after: { ...data } }, tx);
    });
    return this.getRun(actor, runId);
  }

  async removeItem(actor: Actor, runId: string, itemId: string) {
    assertPermission(actor, "payroll.manage");
    await inTransaction(async (tx) => {
      await this.lockDraft(actor, runId, tx);
      const item = await this.repo.findItem(runId, itemId, tx);
      if (!item) throw AppError.notFound("Payroll line not found");
      await this.repo.deleteItem(itemId, tx);
      await this.repo.refreshTotals(runId, tx);
      await this.audit.log(actor, { action: "delete", entityType: "payroll_item", entityId: itemId, summary: `Removed ${item.employeeName} from the payroll` }, tx);
    });
    return this.getRun(actor, runId);
  }

  /** Owner approval. Loan/advance deductions become repayments now. */
  async approve(actor: Actor, id: string) {
    assertPermission(actor, "payroll.approve");
    const settings = await this.settings.get(actor.organizationId);
    await inTransaction(async (tx) => {
      const run = await this.lockDraft(actor, id, tx);
      const items = await this.repo.items(id, tx);
      if (items.length === 0) throw AppError.badRequest("This payroll has no employees");
      for (const item of items) {
        for (const line of item.loanDeductionLines) {
          await this.loans.lock(line.loanId, tx);
          await this.loans.insertRepayment(
            { organizationId: actor.organizationId, loanId: line.loanId, payrollItemId: item.id, amount: line.amount, repaymentDate: run.payDate, source: "payroll", method: null, accountId: null, createdById: actor.id },
            tx
          );
          await this.loans.applyRepaid(line.loanId, line.amount, tx);
        }
      }
      await this.repo.updateRun(id, { status: "approved", approvedById: actor.id, approvedAt: new Date() }, tx);
      await this.audit.log(actor, { action: "approve", entityType: "payroll_run", entityId: id, summary: `Approved payroll ${run.code}: net ${formatMoney(run.totalNet, settings.currencySymbol)}` }, tx);
    });
    return this.getRun(actor, id);
  }

  async cancel(actor: Actor, id: string) {
    const run = await this.getRun(actor, id);
    if (run.status === "draft") assertPermission(actor, "payroll.manage");
    else assertPermission(actor, "payroll.approve");
    if (run.status === "paid" || run.status === "cancelled") throw AppError.badRequest(`A ${run.status} payroll can't be cancelled`);
    if (run.totalPaid > 0) throw AppError.conflict("Salaries have already been paid on this run");
    await inTransaction(async (tx) => {
      await this.repo.lockRun(id, tx);
      if (run.status === "approved") {
        const repayments = await this.loans.repaymentsForPayrollItems(run.items.map((i) => i.id), tx);
        for (const r of repayments) {
          await this.loans.lock(r.loanId, tx);
          await this.loans.applyRepaid(r.loanId, -Number(r.amount), tx);
        }
        await this.loans.softDeleteRepayments(repayments.map((r) => r.id), tx);
      }
      await this.repo.updateRun(id, { status: "cancelled" }, tx);
      await this.audit.log(actor, { action: "cancel", entityType: "payroll_run", entityId: id, summary: `Cancelled payroll ${run.code}` }, tx);
    });
    return this.getRun(actor, id);
  }
}
