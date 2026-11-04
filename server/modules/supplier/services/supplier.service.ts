import type { ExportFormat } from "../../../config/constants";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import type { FileResult } from "../../../shared/http/handler";
import { ExportService } from "../../../shared/services/export.service";
import type { Actor } from "../../../shared/types/actor";
import { addDays, resolveRange, todayIn } from "../../../shared/utils/dates";
import { AuditService } from "../../audit/services/audit.service";
import { OrganizationService } from "../../organization/services/organization.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import type { PayablesSummaryDTO, SupplierBalanceDTO, SupplierDTO, SupplierStatementDTO } from "../dto/supplier.dto";
import { SupplierRepository } from "../repositories/supplier.repository";
import type { CreateSupplierInput, ListSuppliersQuery, SupplierStatementQuery, UpdateSupplierInput } from "../validators/supplier.schema";

export class SupplierService {
  static Instance = new SupplierService();
  private constructor(
    private readonly repo = SupplierRepository.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly organizations = OrganizationService.Instance,
    private readonly exporter = ExportService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private async today(actor: Actor): Promise<string> {
    return todayIn((await this.settings.get(actor.organizationId)).timezone);
  }

  async list(actor: Actor, query: ListSuppliersQuery) {
    return this.repo.list(actor.organizationId, query, await this.today(actor));
  }

  async get(actor: Actor, id: string): Promise<SupplierDTO & SupplierBalanceDTO> {
    const supplier = await this.repo.findById(actor.organizationId, id);
    if (!supplier) throw AppError.notFound("Supplier not found");
    return { ...supplier, ...(await this.repo.balance(actor.organizationId, id, await this.today(actor))) };
  }

  async create(actor: Actor, data: CreateSupplierInput): Promise<SupplierDTO & SupplierBalanceDTO> {
    assertPermission(actor, "supplier.manage");
    const id = await inTransaction(async (tx) => {
      const code = await this.codes.next(actor.organizationId, "supplier", tx);
      const supplierId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          code,
          type: data.type,
          name: data.name,
          contactPerson: data.contactPerson ?? null,
          phone: data.phone ?? null,
          email: data.email ?? null,
          address: data.address ?? null,
          category: data.category ?? null,
          bankName: data.bankName ?? null,
          bankAccountNumber: data.bankAccountNumber ?? null,
          bankAccountName: data.bankAccountName ?? null,
          paymentTermsDays: data.paymentTermsDays ?? null,
          notes: data.notes ?? null,
          isActive: true,
        },
        tx
      );
      await this.audit.log(actor, { action: "create", entityType: "supplier", entityId: supplierId, summary: `Created ${data.type} ${data.name} (${code})`, after: { ...data, code } }, tx);
      return supplierId;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateSupplierInput): Promise<SupplierDTO & SupplierBalanceDTO> {
    assertPermission(actor, "supplier.manage");
    const before = await this.repo.findById(actor.organizationId, id);
    if (!before) throw AppError.notFound("Supplier not found");
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, data, tx);
      await this.audit.log(actor, { action: "update", entityType: "supplier", entityId: id, summary: `Updated ${before.type} ${before.name}`, before: { ...before }, after: data }, tx);
    });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "supplier.manage");
    const supplier = await this.repo.findById(actor.organizationId, id);
    if (!supplier) throw AppError.notFound("Supplier not found");
    if (await this.repo.hasActivity(id)) {
      throw AppError.conflict("This supplier has supplies or payments on record. Mark them inactive instead.");
    }
    await inTransaction(async (tx) => {
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "supplier", entityId: id, summary: `Deleted ${supplier.type} ${supplier.name}`, before: { ...supplier } }, tx);
    });
  }

  async statementData(actor: Actor, id: string, query: { from?: string; to?: string }): Promise<SupplierStatementDTO> {
    const supplier = await this.repo.findById(actor.organizationId, id);
    if (!supplier) throw AppError.notFound("Supplier not found");
    const { timezone } = await this.settings.get(actor.organizationId);
    // Default window: the last 12 months, so the statement is useful without picking dates.
    const today = todayIn(timezone);
    const { from, to } = resolveRange(timezone, query.from ?? addDays(today, -365), query.to);
    const openingBalance = await this.repo.balanceBefore(id, from);
    const entries = await this.repo.ledger(id, from, to, openingBalance);
    const totalSupplied = entries.reduce((s, e) => s + Number(e.supplied), 0);
    const totalPaid = entries.reduce((s, e) => s + Number(e.paid), 0);
    return { supplier, from, to, openingBalance, totalSupplied, totalPaid, closingBalance: openingBalance + totalSupplied - totalPaid, entries };
  }

  async statement(actor: Actor, id: string, query: SupplierStatementQuery): Promise<SupplierStatementDTO | FileResult> {
    const data = await this.statementData(actor, id, query);
    if (query.format === "json") return data;
    assertPermission(actor, "report.export");
    return this.exportStatement(actor, data, query.format);
  }

  private async exportStatement(actor: Actor, s: SupplierStatementDTO, format: Exclude<ExportFormat, "json">): Promise<FileResult> {
    const ctx = await this.organizations.exportContext(actor);
    return this.exporter.render(
      format,
      {
        title: `${s.supplier.type === "vendor" ? "Vendor" : "Supplier"} statement — ${s.supplier.name}`,
        subtitle: `${s.supplier.code} · ${s.from} to ${s.to}${s.supplier.phone ? ` · ${s.supplier.phone}` : ""}`,
        summary: [
          { label: "Opening balance", value: s.openingBalance, type: "money" },
          { label: "Total supplied", value: s.totalSupplied, type: "money" },
          { label: "Total paid", value: s.totalPaid, type: "money" },
          { label: "Balance owed", value: s.closingBalance, type: "money" },
        ],
        columns: [
          { key: "date", label: "Date", type: "date" },
          { key: "reference", label: "Reference" },
          { key: "description", label: "Description", width: 2.5 },
          { key: "supplied", label: "Supplied", type: "money" },
          { key: "paid", label: "Paid", type: "money" },
          { key: "balance", label: "Balance", type: "money" },
        ],
        rows: s.entries as unknown as Array<Record<string, unknown>>,
        totals: { description: "Totals", supplied: s.totalSupplied, paid: s.totalPaid, balance: s.closingBalance },
      },
      ctx,
      `statement-${s.supplier.code}-${s.from}-${s.to}`
    );
  }

  /** Dashboard widget: what the business owes, what's overdue, what's due soon, top suppliers. */
  async payables(actor: Actor, type?: "supplier" | "vendor"): Promise<PayablesSummaryDTO> {
    const settings = await this.settings.get(actor.organizationId);
    const today = todayIn(settings.timezone);
    const dueSoonUntil = addDays(today, Math.max(settings.reminderDaysBeforeDue, 7));
    const [totals, top, due] = await Promise.all([
      this.repo.payableTotals(actor.organizationId, today, dueSoonUntil, type),
      this.repo.topSuppliers(actor.organizationId, addDays(today, -90), 5, type),
      this.repo.dueSupplies(actor.organizationId, today, dueSoonUntil, 50),
    ]);
    return {
      ...totals,
      topSuppliers: top,
      overdue: due.filter((d) => d.dueDate < today),
      dueSoon: due.filter((d) => d.dueDate >= today),
    };
  }
}
