import { DEFAULT_EXPENSE_CATEGORIES, STORAGE_FOLDERS } from "../../../config/constants";
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { ExportService } from "../../../shared/services/export.service";
import { StorageService } from "../../../shared/services/storage.service";
import type { Actor } from "../../../shared/types/actor";
import { resolveRange, todayIn } from "../../../shared/utils/dates";
import { formatMoney } from "../../../shared/utils/money";
import { AuditService } from "../../audit/services/audit.service";
import { LedgerService } from "../../finance/services/ledger.service";
import { BranchService } from "../../organization/services/branch.service";
import { OrganizationService } from "../../organization/services/organization.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import { SupplierRepository } from "../../supplier/repositories/supplier.repository";
import type { ExpenseCategoryDTO, ExpenseDTO } from "../dto/expense.dto";
import { ExpenseRepository } from "../repositories/expense.repository";
import type { CreateExpenseInput, ExpenseReportQuery, ListExpensesQuery, UpdateExpenseInput } from "../validators/expense.schema";

export class ExpenseService {
  static Instance = new ExpenseService();
  private constructor(
    private readonly repo = ExpenseRepository.Instance,
    private readonly suppliers = SupplierRepository.Instance,
    private readonly ledger = LedgerService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly organizations = OrganizationService.Instance,
    private readonly exporter = ExportService.Instance,
    private readonly storage = StorageService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  // ── Categories ─────────────────────────────────────────────────────────────
  async seedCategories(organizationId: string, tx: Tx): Promise<void> {
    for (const name of DEFAULT_EXPENSE_CATEGORIES) await this.repo.createCategory(organizationId, name, true, tx);
  }

  categories(actor: Actor, includeInactive = false): Promise<ExpenseCategoryDTO[]> {
    return this.repo.categories(actor.organizationId, includeInactive);
  }

  async createCategory(actor: Actor, name: string): Promise<ExpenseCategoryDTO> {
    assertPermission(actor, "expense.manage");
    if (await this.repo.categoryNameTaken(actor.organizationId, name)) throw AppError.conflict("This category already exists");
    const id = await inTransaction(async (tx) => {
      const categoryId = await this.repo.createCategory(actor.organizationId, name, false, tx);
      await this.audit.log(actor, { action: "create", entityType: "expense_category", entityId: categoryId, summary: `Created expense category ${name}` }, tx);
      return categoryId;
    });
    return (await this.repo.findCategory(actor.organizationId, id)) as ExpenseCategoryDTO;
  }

  async updateCategory(actor: Actor, id: string, data: { name?: string; isActive?: boolean }): Promise<ExpenseCategoryDTO> {
    assertPermission(actor, "expense.manage");
    const category = await this.repo.findCategory(actor.organizationId, id);
    if (!category) throw AppError.notFound("Category not found");
    if (data.name && (await this.repo.categoryNameTaken(actor.organizationId, data.name, id))) throw AppError.conflict("This category already exists");
    await this.repo.updateCategory(actor.organizationId, id, data);
    return (await this.repo.findCategory(actor.organizationId, id)) as ExpenseCategoryDTO;
  }

  async removeCategory(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "expense.manage");
    const category = await this.repo.findCategory(actor.organizationId, id);
    if (!category) throw AppError.notFound("Category not found");
    if (category.isSystem) throw AppError.badRequest("Built-in categories can be hidden (set inactive) but not deleted");
    if (category.expenseCount > 0) throw AppError.conflict("This category has expenses. Set it inactive instead.");
    await inTransaction(async (tx) => {
      await this.repo.deleteCategory(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "expense_category", entityId: id, summary: `Deleted expense category ${category.name}` }, tx);
    });
  }

  // ── Expenses ───────────────────────────────────────────────────────────────
  async list(actor: Actor, query: ListExpensesQuery) {
    return this.repo.list(actor.organizationId, { ...query, branchId: readBranchScope(actor, query.branchId) });
  }

  async get(actor: Actor, id: string): Promise<ExpenseDTO> {
    const expense = await this.repo.findById(actor.organizationId, id);
    if (!expense) throw AppError.notFound("Expense not found");
    readBranchScope(actor, expense.branchId);
    return expense;
  }

  private async assertRefs(actor: Actor, categoryId?: string, supplierId?: string | null, tx?: Tx): Promise<void> {
    if (categoryId) {
      const category = await this.repo.findCategory(actor.organizationId, categoryId, tx);
      if (!category || !category.isActive) throw AppError.badRequest("Expense category not found or inactive");
    }
    if (supplierId && !(await this.suppliers.findById(actor.organizationId, supplierId, tx))) throw AppError.badRequest("Vendor not found");
  }

  /** Records an expense and pays it out of the chosen account. Used directly and by recurring expenses. */
  async createInTx(actor: Actor, data: CreateExpenseInput & { recurringExpenseId?: string | null }, tx: Tx): Promise<string> {
    const { timezone, currencySymbol } = await this.settings.get(actor.organizationId);
    await this.assertRefs(actor, data.categoryId, data.supplierId, tx);
    const branchId = await this.branches.resolveForWrite(actor, data.branchId, tx);
    const date = data.expenseDate ?? todayIn(timezone);
    const accountId = await this.ledger.resolveAccount(actor, { method: data.method, accountId: data.accountId, branchId }, tx);
    const code = await this.codes.next(actor.organizationId, "expense", tx);
    const id = await this.repo.create(
      {
        organizationId: actor.organizationId,
        branchId,
        code,
        expenseDate: date,
        categoryId: data.categoryId,
        amount: data.amount,
        method: data.method,
        accountId,
        payee: data.payee ?? null,
        supplierId: data.supplierId ?? null,
        description: data.description ?? null,
        receiptUrl: null,
        receiptPublicId: null,
        recurringExpenseId: data.recurringExpenseId ?? null,
        clientRef: data.clientRef ?? null,
        createdById: actor.id,
      },
      tx
    );
    await this.ledger.post(actor, actor.organizationId, { accountId, branchId, date, direction: "out", amount: data.amount, type: "expense", referenceType: "expense", referenceId: id, description: `${code} ${data.payee ?? "expense"}` }, tx);
    await this.audit.log(actor, { action: "create", entityType: "expense", entityId: id, summary: `${code}: expense of ${formatMoney(data.amount, currencySymbol)}${data.payee ? ` to ${data.payee}` : ""}`, after: { ...data, date, accountId } }, tx);
    return id;
  }

  async create(actor: Actor, data: CreateExpenseInput): Promise<ExpenseDTO> {
    assertPermission(actor, "expense.manage");
    if (data.clientRef) {
      const existing = await this.repo.findIdByClientRef(actor.organizationId, data.clientRef);
      if (existing) return this.get(actor, existing);
    }
    const id = await inTransaction((tx) => this.createInTx(actor, data, tx));
    return this.get(actor, id);
  }

  /** Editing re-posts the money movement when the amount, date or account changes. */
  async update(actor: Actor, id: string, data: UpdateExpenseInput): Promise<ExpenseDTO> {
    assertPermission(actor, "expense.manage");
    const before = await this.get(actor, id);
    const { timezone } = await this.settings.get(actor.organizationId);
    await inTransaction(async (tx) => {
      await this.repo.lock(id, tx);
      await this.assertRefs(actor, data.categoryId, data.supplierId, tx);
      const branchId = data.branchId ? await this.branches.resolveForWrite(actor, data.branchId, tx) : before.branchId;
      const method = data.method ?? before.method;
      const moneyChanged = data.amount !== undefined || data.method !== undefined || data.accountId !== undefined || data.expenseDate !== undefined || data.branchId !== undefined;
      const accountId = data.method || data.accountId
        ? await this.ledger.resolveAccount(actor, { method: method as CreateExpenseInput["method"], accountId: data.accountId, branchId }, tx)
        : before.accountId;
      const { branchId: _b, accountId: _a, ...rest } = data;
      await this.repo.update(actor.organizationId, id, { ...rest, branchId, accountId }, tx);
      if (moneyChanged) {
        await this.ledger.reverseReference(actor, "expense", id, todayIn(timezone), `${before.code} edited`, tx);
        await this.ledger.post(actor, actor.organizationId, { accountId, branchId, date: data.expenseDate ?? before.expenseDate, direction: "out", amount: data.amount ?? before.amount, type: "expense", referenceType: "expense", referenceId: id, description: `${before.code} ${data.payee ?? before.payee ?? "expense"} (edited)` }, tx);
      }
      await this.audit.log(actor, { action: "update", entityType: "expense", entityId: id, summary: `Updated expense ${before.code}`, before: { ...before }, after: data }, tx);
    });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "expense.manage");
    const expense = await this.get(actor, id);
    const { timezone } = await this.settings.get(actor.organizationId);
    await inTransaction(async (tx) => {
      await this.repo.lock(id, tx);
      await this.ledger.reverseReference(actor, "expense", id, todayIn(timezone), `${expense.code} deleted`, tx);
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "expense", entityId: id, summary: `Deleted expense ${expense.code}`, before: { ...expense } }, tx);
    });
  }

  async uploadReceipt(actor: Actor, id: string, file: { buffer: Buffer; mimetype: string }): Promise<ExpenseDTO> {
    assertPermission(actor, "expense.manage");
    const expense = await this.get(actor, id);
    const { url, publicId } = await this.storage.replace(
      file.buffer,
      { folder: STORAGE_FOLDERS.expense, kind: file.mimetype.startsWith("image/") ? "image" : "document" },
      expense.receiptPublicId
    );
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, { receiptUrl: url, receiptPublicId: publicId }, tx);
      await this.audit.log(actor, { action: "update", entityType: "expense", entityId: id, summary: `Attached receipt to ${expense.code}` }, tx);
    });
    return this.get(actor, id);
  }

  /** Expense report grouped by category, payee, method or period — JSON or exported. */
  async report(actor: Actor, query: ExpenseReportQuery) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const { from, to } = resolveRange(timezone, query.from, query.to);
    const { groupBy, format, ...filters } = query;
    const rows = await this.repo.grouped(actor.organizationId, groupBy, { ...filters, from, to, branchId: readBranchScope(actor, query.branchId) });
    const total = rows.reduce((s, r) => s + r.total, 0);
    const data = { from, to, groupBy, total, count: rows.reduce((s, r) => s + r.count, 0), rows: rows.map((r) => ({ ...r, share: total > 0 ? Math.round((r.total * 10_000) / total) : 0 })) };
    if (format === "json") return data;
    assertPermission(actor, "report.export");
    const label = { category: "Category", payee: "Payee", method: "Payment method", day: "Day", week: "Week", month: "Month" }[groupBy];
    return this.exporter.render(
      format,
      {
        title: `Expenses by ${label.toLowerCase()}`,
        subtitle: `${from} to ${to}`,
        columns: [
          { key: "label", label, width: 2 },
          { key: "count", label: "Entries", type: "number" },
          { key: "total", label: "Amount", type: "money" },
          { key: "share", label: "Share", type: "percent" },
        ],
        rows: data.rows as unknown as Array<Record<string, unknown>>,
        totals: { label: "Total", count: data.count, total, share: 10_000 },
      },
      await this.organizations.exportContext(actor),
      `expenses-by-${groupBy}-${from}-${to}`
    );
  }
}
