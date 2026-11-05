// Point of sale. A sale is one transaction: stock out, money in (split methods allowed), any
// balance left on the customer's account, commission and an audit row — all or nothing.
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { ownSalesOnly, readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import type { Actor } from "../../../shared/types/actor";
import { addDays, resolveRange, toDateIn } from "../../../shared/utils/dates";
import { randomToken } from "../../../shared/utils/jwt";
import { applyBps, formatMoney } from "../../../shared/utils/money";
import { AuditService } from "../../audit/services/audit.service";
import { CustomerRepository } from "../../customer/repositories/customer.repository";
import { CustomerService } from "../../customer/services/customer.service";
import { ReceivableAllocationService } from "../../customer/services/receivableAllocation.service";
import { EmployeeRepository } from "../../employee/repositories/employee.repository";
import { LedgerService } from "../../finance/services/ledger.service";
import { StockService } from "../../inventory/services/stock.service";
import { AlertScannerService } from "../../notification/services/alertScanner.service";
import { BranchService } from "../../organization/services/branch.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import { VariantRepository } from "../../product/repositories/variant.repository";
import { priceCart, PricingError } from "../domain/pricing";
import type { SaleCreatedDTO, SaleDetailDTO } from "../dto/sale.dto";
import { SaleRepository } from "../repositories/sale.repository";
import type { CreateSaleInput, ListSalesQuery } from "../validators/sale.schema";

/** How old a sale time may be without the backdate permission (sales queued offline). */
const OFFLINE_SYNC_HOURS = 72;

export interface CreateSaleOptions {
  /** Prices agreed on a quotation may differ from the list price without `sale.priceoverride`. */
  agreedPrices?: boolean;
  quotationId?: string;
}

export class SaleService {
  static Instance = new SaleService();
  private constructor(
    private readonly repo = SaleRepository.Instance,
    private readonly variants = VariantRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly customerService = CustomerService.Instance,
    private readonly receivables = ReceivableAllocationService.Instance,
    private readonly employees = EmployeeRepository.Instance,
    private readonly stock = StockService.Instance,
    private readonly ledger = LedgerService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly alerts = AlertScannerService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private hideCost<T extends { costTotal?: number; unitCost?: number }>(actor: Actor, row: T): T {
    if (can(actor, "product.viewcost")) return row;
    const { costTotal: _c, unitCost: _u, ...rest } = row;
    return rest as T;
  }

  async list(actor: Actor, query: ListSalesQuery) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const range = query.from || query.to ? resolveRange(timezone, query.from, query.to) : null;
    const own = ownSalesOnly(actor);
    const result = await this.repo.list(actor.organizationId, {
      ...query,
      from: range?.from,
      to: range?.to,
      timezone,
      branchId: readBranchScope(actor, query.branchId),
      soldById: own ?? query.soldById ?? null,
    });
    return { data: result.data.map((s) => this.hideCost(actor, s)), meta: result.meta };
  }

  async get(actor: Actor, id: string, tx?: Tx): Promise<SaleDetailDTO> {
    const sale = await this.repo.findById(actor.organizationId, id, tx);
    if (!sale) throw AppError.notFound("Sale not found");
    const own = ownSalesOnly(actor);
    if (own && sale.soldById !== own) throw AppError.forbidden("You can only view your own sales");
    readBranchScope(actor, sale.branchId);
    const [items, payments, laterPayments, returns] = await Promise.all([
      this.repo.items(id, tx),
      this.repo.payments(id, tx),
      tx ? Promise.resolve([]) : this.repo.laterPayments(id),
      tx ? Promise.resolve([]) : this.repo.returns(id),
    ]);
    return this.hideCost(actor, { ...sale, items: items.map((i) => this.hideCost(actor, i)), payments, laterPayments, returns });
  }

  async create(actor: Actor, data: CreateSaleInput): Promise<SaleCreatedDTO> {
    assertPermission(actor, "sale.create");
    if (data.clientRef) {
      const existing = await this.repo.findIdByClientRef(actor.organizationId, data.clientRef);
      if (existing) return { sale: await this.get(actor, existing), changeDue: 0, creditApplied: 0 };
    }
    const result = await inTransaction((tx) => this.createInTx(actor, data, tx));
    this.alerts.scanLowStockSoon(actor.organizationId);
    domainEvents.emit("sale.created", { organizationId: actor.organizationId, saleId: result.saleId });
    return { ...result, sale: await this.get(actor, result.saleId) };
  }

  /** Records a sale inside the caller's transaction (also used when converting a quotation). */
  async createInTx(actor: Actor, data: CreateSaleInput, tx: Tx, options: CreateSaleOptions = {}): Promise<{ saleId: string; changeDue: number; creditApplied: number }> {
    const settings = await this.settings.get(actor.organizationId);
    const branchId = await this.branches.resolveForWrite(actor, data.branchId, tx);

    let soldAt = new Date();
    if (data.soldAt) {
      soldAt = new Date(data.soldAt);
      // Sales made offline sync later with the time they really happened. Anyone who can sell may send a
      // time up to OFFLINE_SYNC_HOURS old; anything older is a true backdate and needs `sale.backdate`.
      if (Date.now() - soldAt.getTime() > OFFLINE_SYNC_HOURS * 3_600_000) {
        assertPermission(actor, "sale.backdate", "You cannot record a sale with an earlier date");
      }
      if (soldAt.getTime() > Date.now() + 60_000) throw AppError.badRequest("A sale cannot be dated in the future");
    }
    const saleDate = toDateIn(soldAt, settings.timezone);

    // ── Customer ───────────────────────────────────────────────────────────────
    let customerId = data.customerId ?? null;
    if (customerId) {
      const customer = await this.customers.findById(actor.organizationId, customerId, tx);
      if (!customer) throw AppError.badRequest("Customer not found");
    } else if (data.customer) {
      const existing = data.customer.phone ? await this.customers.findByPhone(actor.organizationId, data.customer.phone, tx) : null;
      if (existing) customerId = existing.id;
      else {
        assertPermission(actor, "customer.manage", "You cannot add new customers");
        customerId = await this.customerService.createInTx(actor, { name: data.customer.name, phone: data.customer.phone ?? null }, tx);
      }
    }

    // ── Lines & pricing ────────────────────────────────────────────────────────
    const variantMap = await this.variants.findManyForSale(actor.organizationId, data.items.map((i) => i.variantId), tx);
    const lines = data.items.map((item) => {
      const variant = variantMap.get(item.variantId);
      if (!variant) throw AppError.badRequest("One of the products was not found");
      if (!variant.isActive) throw AppError.badRequest(`${variant.label} is no longer for sale`);
      const unitPrice = item.unitPrice ?? variant.sellingPrice;
      if (unitPrice !== variant.sellingPrice && !options.agreedPrices) {
        assertPermission(actor, "sale.priceoverride", `You cannot change the price of ${variant.label}`);
      }
      return { item, variant, unitPrice };
    });
    let cart;
    try {
      cart = priceCart(
        lines.map((l) => ({ quantity: l.item.quantity, unitPrice: l.unitPrice, discount: l.item.discount })),
        data.discount,
        { enabled: settings.taxEnabled, rateBps: settings.taxRateBps, inclusive: settings.taxInclusive }
      );
    } catch (err) {
      if (err instanceof PricingError) throw AppError.badRequest(err.message);
      throw err;
    }

    // ── Payments (cash over-tender becomes change) ────────────────────────────
    const payments = data.payments.map((p) => ({ ...p }));
    let paid = payments.reduce((s, p) => s + p.amount, 0);
    let changeDue = 0;
    if (paid > cart.total) {
      const excess = paid - cart.total;
      const cash = payments.filter((p) => p.method === "cash");
      if (cash.reduce((s, p) => s + p.amount, 0) < excess) {
        throw AppError.badRequest("The payments add up to more than the total. Only cash can be over-tendered (to give change).");
      }
      let toTrim = excess;
      for (const p of cash) {
        const cut = Math.min(p.amount, toTrim);
        p.amount -= cut;
        toTrim -= cut;
      }
      changeDue = excess;
      paid = cart.total;
    }
    const tillPayments = payments.filter((p) => p.amount > 0);
    const balanceDue = cart.total - paid;
    if (balanceDue > 0 && !customerId) throw AppError.badRequest("Select or add a customer for a part-payment or credit sale");
    if (balanceDue > 0 && customerId) {
      const customer = await this.customers.findById(actor.organizationId, customerId, tx);
      if (customer?.creditLimit !== null && customer?.creditLimit !== undefined) {
        const owed = await this.repo.customerOutstanding(customerId, tx);
        if (owed + balanceDue > customer.creditLimit) {
          throw AppError.conflict(
            `This would take ${customer.name} over their credit limit of ${formatMoney(customer.creditLimit, settings.currencySymbol)} (currently owes ${formatMoney(Math.max(owed, 0), settings.currencySymbol)})`
          );
        }
      }
    }

    // ── Commission ─────────────────────────────────────────────────────────────
    let commissionRateBps = 0;
    if (settings.commissionEnabled) {
      commissionRateBps = (await this.employees.commissionRateForUser(actor.organizationId, actor.id, tx)) ?? settings.commissionRateBps;
    }
    const commissionAmount = applyBps(cart.total - cart.taxAmount, commissionRateBps);
    const costTotal = lines.reduce((s, l) => s + l.item.quantity * l.variant.costPrice, 0);

    // ── Persist ────────────────────────────────────────────────────────────────
    const code = await this.codes.next(actor.organizationId, "sale", tx);
    const saleId = await this.repo.create(
      {
        organizationId: actor.organizationId,
        branchId,
        code,
        customerId,
        soldById: actor.id,
        soldAt,
        status: "completed",
        subtotal: cart.subtotal,
        discountTotal: cart.discountTotal,
        taxRateBps: cart.taxRateBps,
        taxAmount: cart.taxAmount,
        total: cart.total,
        amountPaid: paid,
        balanceDue,
        paymentStatus: balanceDue === 0 ? "paid" : paid > 0 ? "part_paid" : "credit",
        dueDate: balanceDue > 0 ? (data.dueDate ?? addDays(saleDate, settings.defaultCreditDays)) : null,
        costTotal,
        commissionRateBps,
        commissionAmount,
        returnedAmount: 0,
        notes: data.notes ?? null,
        receiptToken: randomToken(18),
        quotationId: options.quotationId ?? null,
        clientRef: data.clientRef ?? null,
        voidedAt: null,
        voidedById: null,
        voidReason: null,
      },
      tx
    );
    await this.repo.insertItems(
      lines.map((l, i) => ({
        saleId,
        variantId: l.variant.id,
        productId: l.variant.productId,
        productName: l.variant.productName,
        variantName: l.variant.variantName === "Default" ? null : l.variant.variantName,
        sku: l.variant.sku,
        quantity: l.item.quantity,
        unitPrice: l.unitPrice,
        listPrice: l.variant.sellingPrice,
        discount: cart.lines[i].discount,
        lineTotal: cart.lines[i].lineTotal,
        unitCost: l.variant.costPrice,
        returnedQuantity: 0,
      })),
      tx
    );
    for (const p of tillPayments) {
      const accountId = await this.ledger.resolveAccount(actor, { method: p.method, accountId: p.accountId, branchId }, tx);
      await this.repo.insertPayment({ organizationId: actor.organizationId, saleId, method: p.method, accountId, amount: p.amount, reference: p.reference ?? null }, tx);
      await this.ledger.post(actor, actor.organizationId, { accountId, branchId, date: saleDate, direction: "in", amount: p.amount, type: "sale_payment", referenceType: "sale", referenceId: saleId, description: `${code} sale (${p.method})` }, tx);
    }
    for (const l of lines) {
      await this.stock.move(
        actor,
        actor.organizationId,
        { branchId, variantId: l.variant.id, productId: l.variant.productId, delta: -l.item.quantity, type: "sale", unitCost: l.variant.costPrice, referenceType: "sale", referenceId: saleId, label: l.variant.label },
        tx
      );
    }
    const creditApplied = balanceDue > 0 && customerId ? await this.receivables.applyCredits(customerId, tx) : 0;

    await this.audit.log(
      actor,
      {
        action: "create",
        entityType: "sale",
        entityId: saleId,
        summary: `${code}: sale of ${formatMoney(cart.total, settings.currencySymbol)}${balanceDue > 0 ? ` (${formatMoney(balanceDue, settings.currencySymbol)} on credit)` : ""}`,
        after: { total: cart.total, paid, balanceDue, discount: cart.discountTotal, tax: cart.taxAmount, items: lines.length, customerId },
      },
      tx
    );
    return { saleId, changeDue, creditApplied };
  }

  /** Cancels a sale entirely: stock goes back, till payments are reversed, later debt payments become customer credit. */
  async void(actor: Actor, id: string, reason: string): Promise<SaleDetailDTO> {
    assertPermission(actor, "sale.void");
    const { timezone } = await this.settings.get(actor.organizationId);
    await inTransaction(async (tx) => {
      await this.repo.lock(id, tx);
      const sale = await this.get(actor, id, tx);
      if (sale.status === "voided") throw AppError.badRequest("This sale is already voided");
      if (sale.returnedAmount > 0) throw AppError.conflict("This sale has returns. Return the remaining items instead of voiding it.");

      await this.receivables.releaseSale(id, tx);
      for (const item of await this.repo.items(id, tx)) {
        await this.stock.move(
          actor,
          actor.organizationId,
          { branchId: sale.branchId, variantId: item.variantId, productId: item.productId, delta: item.quantity, type: "sale_void", unitCost: item.unitCost ?? 0, referenceType: "sale", referenceId: id, note: `${sale.code} voided`, label: item.productName },
          tx
        );
      }
      const today = toDateIn(new Date(), timezone);
      await this.ledger.reverseReference(actor, "sale", id, today, `${sale.code} voided`, tx);
      await this.repo.update(id, { status: "voided", voidedAt: new Date(), voidedById: actor.id, voidReason: reason, balanceDue: 0, commissionAmount: 0 }, tx);
      await this.audit.log(actor, { action: "void", entityType: "sale", entityId: id, summary: `Voided sale ${sale.code}: ${reason}`, before: { total: sale.total, amountPaid: sale.amountPaid, balanceDue: sale.balanceDue } }, tx);
      if (sale.customerId) await this.receivables.applyCredits(sale.customerId, tx);
    });
    return this.get(actor, id);
  }
}
