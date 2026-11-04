// Staff loans and salary advances. Issuing pays money out; repayment happens through payroll
// deductions (at payroll approval) or manual repayments (money back in).
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { todayIn } from "../../../shared/utils/dates";
import { formatMoney } from "../../../shared/utils/money";
import { AuditService } from "../../audit/services/audit.service";
import { EmployeeRepository } from "../../employee/repositories/employee.repository";
import { LedgerService } from "../../finance/services/ledger.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import { LoanRepository, type LoanDTO, type LoanRepaymentDTO } from "../repositories/loan.repository";
import type { CreateLoanInput, ListLoansQuery, RepayLoanInput, UpdateLoanInput } from "../validators/loan.schema";

export class LoanService {
  static Instance = new LoanService();
  private constructor(
    private readonly repo = LoanRepository.Instance,
    private readonly employees = EmployeeRepository.Instance,
    private readonly ledger = LedgerService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  list(actor: Actor, query: ListLoansQuery) {
    return this.repo.list(actor.organizationId, query);
  }

  async get(actor: Actor, id: string): Promise<LoanDTO & { repayments: LoanRepaymentDTO[] }> {
    const loan = await this.repo.findById(actor.organizationId, id);
    if (!loan) throw AppError.notFound("Loan not found");
    return { ...loan, repayments: await this.repo.repayments(id) };
  }

  async create(actor: Actor, data: CreateLoanInput) {
    assertPermission(actor, "loan.manage");
    const settings = await this.settings.get(actor.organizationId);
    const employee = await this.employees.findById(actor.organizationId, data.employeeId);
    if (!employee) throw AppError.badRequest("Employee not found");
    if (employee.status === "terminated") throw AppError.badRequest("This employee has left the business");
    const issueDate = data.issueDate ?? todayIn(settings.timezone);
    const id = await inTransaction(async (tx) => {
      const accountId = await this.ledger.resolveAccount(actor, { method: data.method, accountId: data.accountId, branchId: employee.branchId }, tx);
      const code = await this.codes.next(actor.organizationId, data.type === "advance" ? "advance" : "loan", tx);
      const loanId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          employeeId: employee.id,
          code,
          type: data.type,
          principal: data.principal,
          issueDate,
          installmentAmount: data.installmentAmount ?? data.principal,
          amountRepaid: 0,
          status: "active",
          method: data.method,
          accountId,
          reference: data.reference ?? null,
          notes: data.notes ?? null,
          createdById: actor.id,
        },
        tx
      );
      await this.ledger.post(actor, actor.organizationId, { accountId, branchId: employee.branchId, date: issueDate, direction: "out", amount: data.principal, type: "loan_disbursement", referenceType: "loan", referenceId: loanId, description: `${code} ${data.type} to ${employee.fullName}` }, tx);
      await this.audit.log(actor, { action: "create", entityType: "loan", entityId: loanId, summary: `${code}: ${data.type} of ${formatMoney(data.principal, settings.currencySymbol)} to ${employee.fullName}`, after: { ...data, issueDate } }, tx);
      return loanId;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateLoanInput) {
    assertPermission(actor, "loan.manage");
    const loan = await this.get(actor, id);
    if (loan.status === "settled") throw AppError.badRequest("This loan is already settled");
    if (data.installmentAmount && data.installmentAmount > loan.principal) throw AppError.badRequest("The installment can't be more than the amount");
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, data, tx);
      await this.audit.log(actor, { action: data.status === "written_off" ? "cancel" : "update", entityType: "loan", entityId: id, summary: `${data.status === "written_off" ? "Wrote off" : "Updated"} ${loan.code}`, before: { installmentAmount: loan.installmentAmount, status: loan.status }, after: data }, tx);
    });
    return this.get(actor, id);
  }

  async repay(actor: Actor, id: string, data: RepayLoanInput) {
    assertPermission(actor, "loan.manage");
    const { timezone } = await this.settings.get(actor.organizationId);
    const date = data.repaymentDate ?? todayIn(timezone);
    await inTransaction(async (tx) => {
      await this.repo.lock(id, tx);
      const loan = await this.repo.findById(actor.organizationId, id, tx);
      if (!loan) throw AppError.notFound("Loan not found");
      if (loan.status !== "active") throw AppError.badRequest(`This loan is ${loan.status}`);
      if (data.amount > loan.outstanding) throw AppError.badRequest("The repayment is more than what is still owed");
      const accountId = await this.ledger.resolveAccount(actor, { method: data.method, accountId: data.accountId }, tx);
      const repaymentId = await this.repo.insertRepayment(
        { organizationId: actor.organizationId, loanId: id, payrollItemId: null, amount: data.amount, repaymentDate: date, source: "manual", method: data.method, accountId, createdById: actor.id },
        tx
      );
      await this.repo.applyRepaid(id, data.amount, tx);
      await this.ledger.post(actor, actor.organizationId, { accountId, date, direction: "in", amount: data.amount, type: "loan_repayment", referenceType: "loan_repayment", referenceId: repaymentId, description: `${loan.code} repayment from ${loan.employeeName}` }, tx);
      await this.audit.log(actor, { action: "pay", entityType: "loan", entityId: id, summary: `${loan.code}: manual repayment`, after: { amount: data.amount, method: data.method, date } }, tx);
    });
    return this.get(actor, id);
  }

  /** Only a loan with no repayments yet can be deleted; the disbursement is reversed. */
  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "loan.manage");
    const loan = await this.get(actor, id);
    if ((await this.repo.countRepayments(id)) > 0) throw AppError.conflict("This loan has repayments. Write it off instead.");
    const { timezone } = await this.settings.get(actor.organizationId);
    await inTransaction(async (tx) => {
      await this.ledger.reverseReference(actor, "loan", id, todayIn(timezone), `${loan.code} deleted`, tx);
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "loan", entityId: id, summary: `Deleted ${loan.code}` }, tx);
    });
  }
}
