import type { ExportFormat } from "../../../config/constants";
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import type { FileResult } from "../../../shared/http/handler";
import { ExportService } from "../../../shared/services/export.service";
import type { Actor } from "../../../shared/types/actor";
import { addDays, resolveRange, todayIn } from "../../../shared/utils/dates";
import { formatMoney } from "../../../shared/utils/money";
import { whatsappLink } from "../../../shared/utils/whatsapp";
import { AuditService } from "../../audit/services/audit.service";
import { OrganizationService } from "../../organization/services/organization.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import type { CustomerBalanceDTO, CustomerDTO, DebtorDTO } from "../dto/customer.dto";
import { CustomerRepository } from "../repositories/customer.repository";
import type { CreateCustomerInput, CustomerStatementQuery, ListCustomersQuery, UpdateCustomerInput } from "../validators/customer.schema";

export class CustomerService {
  static Instance = new CustomerService();
  private constructor(
    private readonly repo = CustomerRepository.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly organizations = OrganizationService.Instance,
    private readonly exporter = ExportService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private async today(organizationId: string): Promise<string> {
    return todayIn((await this.settings.get(organizationId)).timezone);
  }

  async list(actor: Actor, query: ListCustomersQuery) {
    return this.repo.list(actor.organizationId, query, await this.today(actor.organizationId));
  }

  async get(actor: Actor, id: string): Promise<CustomerDTO & CustomerBalanceDTO> {
    const customer = await this.repo.findById(actor.organizationId, id);
    if (!customer) throw AppError.notFound("Customer not found");
    return { ...customer, ...(await this.repo.balance(actor.organizationId, id, await this.today(actor.organizationId))) };
  }

  async history(actor: Actor, id: string, page: number, limit: number) {
    await this.get(actor, id);
    return this.repo.purchaseHistory(id, page, limit);
  }

  /** Creates a customer inside a transaction (also used for quick-add at the POS). */
  async createInTx(actor: Actor, data: CreateCustomerInput, tx: Tx): Promise<string> {
    if (data.phone && (await this.repo.findByPhone(actor.organizationId, data.phone, tx))) {
      throw AppError.conflict("A customer with this phone number already exists");
    }
    const code = await this.codes.next(actor.organizationId, "customer", tx);
    const id = await this.repo.create(
      {
        organizationId: actor.organizationId,
        code,
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null,
        creditLimit: data.creditLimit ?? null,
        isActive: true,
      },
      tx
    );
    await this.audit.log(actor, { action: "create", entityType: "customer", entityId: id, summary: `Created customer ${data.name} (${code})` }, tx);
    return id;
  }

  async create(actor: Actor, data: CreateCustomerInput) {
    assertPermission(actor, "customer.manage");
    const id = await inTransaction((tx) => this.createInTx(actor, data, tx));
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateCustomerInput) {
    assertPermission(actor, "customer.manage");
    const before = await this.repo.findById(actor.organizationId, id);
    if (!before) throw AppError.notFound("Customer not found");
    if (data.phone && data.phone !== before.phone) {
      const clash = await this.repo.findByPhone(actor.organizationId, data.phone);
      if (clash && clash.id !== id) throw AppError.conflict("A customer with this phone number already exists");
    }
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, data, tx);
      await this.audit.log(actor, { action: "update", entityType: "customer", entityId: id, summary: `Updated customer ${before.name}`, before: { ...before }, after: data }, tx);
    });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "customer.manage");
    const customer = await this.get(actor, id);
    if (customer.balance !== 0) throw AppError.conflict("This customer still has a balance. Settle it first.");
    if (await this.repo.hasSales(id)) throw AppError.conflict("This customer has purchase history. Mark them inactive instead.");
    await inTransaction(async (tx) => {
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "customer", entityId: id, summary: `Deleted customer ${customer.name}` }, tx);
    });
  }

  async statement(actor: Actor, id: string, query: CustomerStatementQuery) {
    const customer = await this.get(actor, id);
    const { timezone } = await this.settings.get(actor.organizationId);
    const { from, to } = resolveRange(timezone, query.from ?? addDays(todayIn(timezone), -365), query.to);
    const { opening, entries } = await this.repo.ledger(id, from, to, timezone);
    const totalDebit = entries.reduce((s, e) => s + Number(e.debit), 0);
    const totalCredit = entries.reduce((s, e) => s + Number(e.credit), 0);
    const data = { customer, from, to, openingBalance: opening, totalDebit, totalCredit, closingBalance: opening + totalDebit - totalCredit, entries };
    if (query.format === "json") return data;
    assertPermission(actor, "report.export");
    const ctx = await this.organizations.exportContext(actor);
    return this.exporter.render(
      query.format,
      {
        title: `Customer statement — ${customer.name}`,
        subtitle: `${customer.code} · ${from} to ${to}${customer.phone ? ` · ${customer.phone}` : ""}`,
        summary: [
          { label: "Opening balance", value: opening, type: "money" },
          { label: "Closing balance", value: data.closingBalance, type: "money" },
        ],
        columns: [
          { key: "date", label: "Date", type: "date" },
          { key: "reference", label: "Reference" },
          { key: "description", label: "Description", width: 2.5 },
          { key: "debit", label: "Charged", type: "money" },
          { key: "credit", label: "Paid / credited", type: "money" },
          { key: "balance", label: "Balance", type: "money" },
        ],
        rows: entries as unknown as Array<Record<string, unknown>>,
        totals: { description: "Totals", debit: totalDebit, credit: totalCredit, balance: data.closingBalance },
      },
      ctx,
      `customer-statement-${customer.code}`
    );
  }

  async debtors(actor: Actor, format: ExportFormat): Promise<DebtorDTO[] | FileResult> {
    const rows = await this.repo.debtors(actor.organizationId, await this.today(actor.organizationId));
    if (format === "json") return rows;
    assertPermission(actor, "report.export");
    const ctx = await this.organizations.exportContext(actor);
    const sum = (k: keyof DebtorDTO) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
    return this.exporter.render(
      format,
      {
        title: "Debtors (customers who owe)",
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: "Customer", width: 2 },
          { key: "phone", label: "Phone" },
          { key: "current", label: "Not yet due", type: "money" },
          { key: "days1to30", label: "1–30 days", type: "money" },
          { key: "days31to60", label: "31–60 days", type: "money" },
          { key: "days61to90", label: "61–90 days", type: "money" },
          { key: "over90", label: "90+ days", type: "money" },
          { key: "balance", label: "Balance", type: "money" },
        ],
        rows: rows as unknown as Array<Record<string, unknown>>,
        totals: { name: "Total", current: sum("current"), days1to30: sum("days1to30"), days31to60: sum("days31to60"), days61to90: sum("days61to90"), over90: sum("over90"), balance: sum("balance") },
      },
      ctx,
      "debtors"
    );
  }

  /** A ready-to-send WhatsApp debt reminder for the customer. */
  async reminder(actor: Actor, id: string): Promise<{ message: string; whatsappUrl: string; balance: number }> {
    const customer = await this.get(actor, id);
    if (customer.balance <= 0) throw AppError.badRequest(`${customer.name} has no outstanding balance`);
    const ctx = await this.organizations.exportContext(actor);
    const amount = formatMoney(customer.balance, ctx.currencySymbol);
    const overdue = customer.overdueAmount > 0 ? ` (${formatMoney(customer.overdueAmount, ctx.currencySymbol)} is overdue)` : "";
    const message =
      `Hello ${customer.name}, this is a friendly reminder from ${ctx.businessName} that your outstanding balance is ${amount}${overdue}. ` +
      `Kindly make payment at your earliest convenience. Thank you for your patronage.`;
    return { message, whatsappUrl: whatsappLink(customer.phone, message), balance: customer.balance };
  }

  async receivables(actor: Actor) {
    return this.repo.receivableTotals(actor.organizationId, await this.today(actor.organizationId));
  }
}
