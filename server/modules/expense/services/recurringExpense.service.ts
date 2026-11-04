// Repeating bills (rent, internet…). The scheduler reminds as they fall due; "record" books the
// expense and moves the due date forward one period, "skip" moves it forward without paying.
import type { ExpenseFrequency } from "../../../config/constants";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { addDays, addMonths, todayIn } from "../../../shared/utils/dates";
import { AuditService } from "../../audit/services/audit.service";
import { BranchService } from "../../organization/services/branch.service";
import { SettingsService } from "../../organization/services/settings.service";
import type { RecurringExpenseDTO } from "../dto/expense.dto";
import { ExpenseRepository } from "../repositories/expense.repository";
import { RecurringExpenseRepository } from "../repositories/recurringExpense.repository";
import type { CreateExpenseInput, CreateRecurringInput, RecordRecurringInput, UpdateRecurringInput } from "../validators/expense.schema";
import { ExpenseService } from "./expense.service";

export function nextOccurrence(date: string, frequency: ExpenseFrequency): string {
  switch (frequency) {
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonths(date, 1);
    case "quarterly":
      return addMonths(date, 3);
    case "yearly":
      return addMonths(date, 12);
    default:
      return addMonths(date, 1);
  }
}

export class RecurringExpenseService {
  static Instance = new RecurringExpenseService();
  private constructor(
    private readonly repo = RecurringExpenseRepository.Instance,
    private readonly expenses = ExpenseRepository.Instance,
    private readonly expenseService = ExpenseService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private async today(actor: Actor): Promise<string> {
    return todayIn((await this.settings.get(actor.organizationId)).timezone);
  }

  async list(actor: Actor, query: { includeInactive?: boolean; branchId?: string }): Promise<RecurringExpenseDTO[]> {
    return this.repo.list(actor.organizationId, await this.today(actor), { branchId: readBranchScope(actor, query.branchId), includeInactive: Boolean(query.includeInactive) });
  }

  async get(actor: Actor, id: string): Promise<RecurringExpenseDTO> {
    const item = await this.repo.findById(actor.organizationId, id, await this.today(actor));
    if (!item) throw AppError.notFound("Recurring expense not found");
    return item;
  }

  async create(actor: Actor, data: CreateRecurringInput): Promise<RecurringExpenseDTO> {
    assertPermission(actor, "expense.manage");
    const category = await this.expenses.findCategory(actor.organizationId, data.categoryId);
    if (!category) throw AppError.badRequest("Expense category not found");
    const branchId = await this.branches.resolveForWrite(actor, data.branchId);
    const id = await inTransaction(async (tx) => {
      const recurringId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          branchId,
          categoryId: data.categoryId,
          name: data.name,
          amount: data.amount,
          method: data.method,
          accountId: data.accountId ?? null,
          payee: data.payee ?? null,
          supplierId: data.supplierId ?? null,
          frequency: data.frequency,
          startDate: data.startDate,
          nextDueDate: data.startDate,
          endDate: data.endDate ?? null,
          isActive: true,
          lastRecordedAt: null,
          notes: data.notes ?? null,
          createdById: actor.id,
        },
        tx
      );
      await this.audit.log(actor, { action: "create", entityType: "recurring_expense", entityId: recurringId, summary: `Created recurring expense ${data.name} (${data.frequency})`, after: { ...data } }, tx);
      return recurringId;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateRecurringInput): Promise<RecurringExpenseDTO> {
    assertPermission(actor, "expense.manage");
    const before = await this.get(actor, id);
    const branchId = data.branchId ? await this.branches.resolveForWrite(actor, data.branchId) : undefined;
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, { ...data, ...(branchId ? { branchId } : {}) }, tx);
      await this.audit.log(actor, { action: "update", entityType: "recurring_expense", entityId: id, summary: `Updated recurring expense ${before.name}`, before: { ...before }, after: data }, tx);
    });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "expense.manage");
    const item = await this.get(actor, id);
    await inTransaction(async (tx) => {
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "recurring_expense", entityId: id, summary: `Deleted recurring expense ${item.name}` }, tx);
    });
  }

  /** Pay this period's bill: creates the expense, then moves the due date one period forward. */
  async record(actor: Actor, id: string, data: RecordRecurringInput) {
    assertPermission(actor, "expense.manage");
    const result = await inTransaction(async (tx) => {
      await this.repo.lock(id, tx);
      const item = await this.repo.findById(actor.organizationId, id, await this.today(actor), tx);
      if (!item) throw AppError.notFound("Recurring expense not found");
      if (!item.isActive) throw AppError.badRequest("This recurring expense is paused");
      const expenseId = await this.expenseService.createInTx(
        actor,
        {
          branchId: item.branchId,
          expenseDate: data.expenseDate ?? item.nextDueDate,
          categoryId: item.categoryId,
          amount: data.amount ?? item.amount,
          method: (data.method ?? item.method) as CreateExpenseInput["method"],
          accountId: data.accountId ?? item.accountId ?? undefined,
          payee: item.payee,
          supplierId: item.supplierId,
          description: data.description ?? `${item.name} (${item.frequency}, due ${item.nextDueDate})`,
          clientRef: data.clientRef,
          recurringExpenseId: item.id,
        },
        tx
      );
      const next = nextOccurrence(item.nextDueDate, item.frequency as ExpenseFrequency);
      const finished = item.endDate !== null && next > item.endDate;
      await this.repo.update(actor.organizationId, id, { nextDueDate: next, lastRecordedAt: new Date(), ...(finished ? { isActive: false } : {}) }, tx);
      return expenseId;
    });
    return { expense: await this.expenseService.get(actor, result), recurring: await this.get(actor, id) };
  }

  async skip(actor: Actor, id: string): Promise<RecurringExpenseDTO> {
    assertPermission(actor, "expense.manage");
    const item = await this.get(actor, id);
    await inTransaction(async (tx) => {
      const next = nextOccurrence(item.nextDueDate, item.frequency as ExpenseFrequency);
      await this.repo.update(actor.organizationId, id, { nextDueDate: next }, tx);
      await this.audit.log(actor, { action: "update", entityType: "recurring_expense", entityId: id, summary: `Skipped ${item.name} due ${item.nextDueDate}` }, tx);
    });
    return this.get(actor, id);
  }
}
