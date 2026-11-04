// Quotations / proforma invoices. No stock or money moves until a quotation is converted to a sale,
// which happens in one transaction at the quoted prices.
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { FileResult } from "../../../shared/http/handler";
import type { Actor } from "../../../shared/types/actor";
import { addDays, todayIn } from "../../../shared/utils/dates";
import { renderReceipt } from "../../../shared/utils/pdf/receipt.pdf";
import { AuditService } from "../../audit/services/audit.service";
import { CustomerRepository } from "../../customer/repositories/customer.repository";
import { OrganizationService } from "../../organization/services/organization.service";
import { BranchService } from "../../organization/services/branch.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import { VariantRepository } from "../../product/repositories/variant.repository";
import { priceCart, PricingError } from "../../sale/domain/pricing";
import { SaleService } from "../../sale/services/sale.service";
import { QuotationRepository, type QuotationDTO } from "../repositories/quotation.repository";
import type { ConvertQuotationInput, CreateQuotationInput, ListQuotationsQuery, UpdateQuotationInput } from "../validators/quotation.schema";

export class QuotationService {
  static Instance = new QuotationService();
  private constructor(
    private readonly repo = QuotationRepository.Instance,
    private readonly variants = VariantRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly sales = SaleService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly organizations = OrganizationService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async list(actor: Actor, query: ListQuotationsQuery) {
    return this.repo.list(actor.organizationId, { ...query, branchId: readBranchScope(actor, query.branchId) });
  }

  async get(actor: Actor, id: string, tx?: Tx): Promise<QuotationDTO> {
    const quote = await this.repo.findById(actor.organizationId, id, tx);
    if (!quote) throw AppError.notFound("Quotation not found");
    readBranchScope(actor, quote.branchId);
    return { ...quote, items: await this.repo.items(id, tx) };
  }

  /** Prices the lines (list price unless a quoted price is given and the user may change prices). */
  private async price(actor: Actor, data: Pick<CreateQuotationInput, "items" | "discount">, tx: Tx) {
    const settings = await this.settings.get(actor.organizationId);
    const variants = await this.variants.findManyForSale(actor.organizationId, data.items.map((i) => i.variantId), tx);
    const lines = data.items.map((item) => {
      const variant = variants.get(item.variantId);
      if (!variant) throw AppError.badRequest("One of the products was not found");
      const unitPrice = item.unitPrice ?? variant.sellingPrice;
      if (unitPrice !== variant.sellingPrice && !can(actor, "sale.priceoverride")) {
        throw AppError.forbidden(`You cannot quote ${variant.label} at a different price`);
      }
      return { item, variant, unitPrice };
    });
    try {
      const cart = priceCart(
        lines.map((l) => ({ quantity: l.item.quantity, unitPrice: l.unitPrice, discount: l.item.discount })),
        data.discount,
        { enabled: settings.taxEnabled, rateBps: settings.taxRateBps, inclusive: settings.taxInclusive }
      );
      return { cart, lines };
    } catch (err) {
      if (err instanceof PricingError) throw AppError.badRequest(err.message);
      throw err;
    }
  }

  private itemRows(priced: Awaited<ReturnType<QuotationService["price"]>>) {
    return priced.lines.map((l, i) => ({
      variantId: l.variant.id,
      productId: l.variant.productId,
      productName: l.variant.productName,
      variantName: l.variant.variantName === "Default" ? null : l.variant.variantName,
      quantity: l.item.quantity,
      unitPrice: l.unitPrice,
      discount: priced.cart.lines[i].discount,
      lineTotal: priced.cart.lines[i].lineTotal,
    }));
  }

  async create(actor: Actor, data: CreateQuotationInput): Promise<QuotationDTO> {
    assertPermission(actor, "quotation.manage");
    const { timezone } = await this.settings.get(actor.organizationId);
    const branchId = await this.branches.resolveForWrite(actor, data.branchId);
    if (data.customerId && !(await this.customers.findById(actor.organizationId, data.customerId))) throw AppError.badRequest("Customer not found");
    if (!data.customerId && !data.customerName) throw AppError.badRequest("Choose a customer or enter the customer's name");
    const quoteDate = data.quoteDate ?? todayIn(timezone);
    const id = await inTransaction(async (tx) => {
      const priced = await this.price(actor, data, tx);
      const code = await this.codes.next(actor.organizationId, "quotation", tx);
      const quoteId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          branchId,
          code,
          customerId: data.customerId ?? null,
          customerName: data.customerName ?? null,
          customerPhone: data.customerPhone ?? null,
          quoteDate,
          validUntil: data.validUntil === undefined ? addDays(quoteDate, 14) : data.validUntil,
          subtotal: priced.cart.subtotal,
          discountTotal: priced.cart.discountTotal,
          taxRateBps: priced.cart.taxRateBps,
          taxAmount: priced.cart.taxAmount,
          total: priced.cart.total,
          status: "draft",
          notes: data.notes ?? null,
          terms: data.terms ?? null,
          convertedSaleId: null,
          createdById: actor.id,
        },
        tx
      );
      await this.repo.replaceItems(quoteId, this.itemRows(priced), tx);
      await this.audit.log(actor, { action: "create", entityType: "quotation", entityId: quoteId, summary: `Created quotation ${code}`, after: { total: priced.cart.total } }, tx);
      return quoteId;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateQuotationInput): Promise<QuotationDTO> {
    assertPermission(actor, "quotation.manage");
    await inTransaction(async (tx) => {
      await this.repo.lock(id, tx);
      const quote = await this.get(actor, id, tx);
      if (!["draft", "sent", "expired"].includes(quote.status)) throw AppError.badRequest(`A ${quote.status} quotation can't be edited`);
      if (data.customerId && !(await this.customers.findById(actor.organizationId, data.customerId, tx))) throw AppError.badRequest("Customer not found");
      const { items, discount, branchId: _b, ...header } = data;
      let totals = {};
      if (items) {
        const priced = await this.price(actor, { items, discount }, tx);
        await this.repo.replaceItems(id, this.itemRows(priced), tx);
        totals = { subtotal: priced.cart.subtotal, discountTotal: priced.cart.discountTotal, taxRateBps: priced.cart.taxRateBps, taxAmount: priced.cart.taxAmount, total: priced.cart.total };
      }
      await this.repo.update(actor.organizationId, id, { ...header, ...totals, ...(quote.status === "expired" ? { status: "draft" } : {}) }, tx);
      await this.audit.log(actor, { action: "update", entityType: "quotation", entityId: id, summary: `Updated quotation ${quote.code}` }, tx);
    });
    return this.get(actor, id);
  }

  async setStatus(actor: Actor, id: string, status: "sent" | "accepted" | "cancelled"): Promise<QuotationDTO> {
    assertPermission(actor, "quotation.manage");
    const quote = await this.get(actor, id);
    if (quote.status === "converted" || quote.status === "cancelled") throw AppError.badRequest(`This quotation is already ${quote.status}`);
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, { status }, tx);
      await this.audit.log(actor, { action: "update", entityType: "quotation", entityId: id, summary: `Quotation ${quote.code} marked ${status}` }, tx);
    });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "quotation.manage");
    const quote = await this.get(actor, id);
    if (quote.status === "converted") throw AppError.badRequest("A converted quotation can't be deleted");
    await inTransaction(async (tx) => {
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "quotation", entityId: id, summary: `Deleted quotation ${quote.code}` }, tx);
    });
  }

  /** Turns the quotation into a real sale at the quoted prices (stock and payments move now). */
  async convert(actor: Actor, id: string, data: ConvertQuotationInput) {
    assertPermission(actor, "sale.create");
    const result = await inTransaction(async (tx) => {
      await this.repo.lock(id, tx);
      const quote = await this.get(actor, id, tx);
      if (quote.status === "converted") throw AppError.conflict("This quotation has already been converted", { saleId: quote.convertedSaleId });
      if (quote.status === "cancelled") throw AppError.badRequest("A cancelled quotation can't be converted");
      const items = quote.items ?? [];
      const sale = await this.sales.createInTx(
        actor,
        {
          branchId: quote.branchId,
          customerId: quote.customerId ?? undefined,
          customer: !quote.customerId && quote.customerName ? { name: quote.customerName, phone: quote.customerPhone } : undefined,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount })),
          discount: quote.discountTotal > 0 ? { type: "amount", value: quote.discountTotal } : undefined,
          payments: data.payments,
          dueDate: data.dueDate,
          notes: data.notes ?? `From quotation ${quote.code}`,
          clientRef: data.clientRef,
        },
        tx,
        { agreedPrices: true, quotationId: quote.id }
      );
      await this.repo.update(actor.organizationId, id, { status: "converted", convertedSaleId: sale.saleId }, tx);
      await this.audit.log(actor, { action: "update", entityType: "quotation", entityId: id, summary: `Converted quotation ${quote.code} to a sale` }, tx);
      return sale;
    });
    return { ...result, sale: await this.sales.get(actor, result.saleId) };
  }

  async pdf(actor: Actor, id: string, title: "quotation" | "proforma"): Promise<FileResult> {
    const quote = await this.get(actor, id);
    const { business, settings } = await this.organizations.getBusiness(actor);
    const buffer = await renderReceipt(
      {
        businessName: business.name,
        businessAddress: business.address,
        businessPhone: business.phone,
        taxNumber: settings.taxNumber,
        header: settings.receiptHeader,
        footer: quote.terms ?? settings.receiptFooter,
        currencySymbol: settings.currencySymbol,
        currencyCode: settings.currencyCode,
        timezone: settings.timezone,
        docTitle: title === "proforma" ? "PROFORMA INVOICE" : "QUOTATION",
        code: quote.code,
        date: quote.quoteDate,
        branchName: quote.branchName,
        servedBy: quote.createdByName,
        customerName: quote.customerName,
        customerPhone: quote.customerPhone,
        items: (quote.items ?? []).map((i) => ({ name: i.variantName ? `${i.productName} (${i.variantName})` : i.productName, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, lineTotal: i.lineTotal })),
        subtotal: quote.subtotal,
        discountTotal: quote.discountTotal,
        taxName: settings.taxName,
        taxRateBps: quote.taxRateBps,
        taxAmount: quote.taxAmount,
        taxInclusive: settings.taxInclusive,
        total: quote.total,
        payments: [],
        amountPaid: null,
        balanceDue: null,
        returnedAmount: 0,
        notes: quote.notes,
        extraLines: quote.validUntil ? [`Valid until ${quote.validUntil}`] : [],
      },
      "a4"
    );
    return new FileResult(`${title}-${quote.code}.pdf`, "application/pdf", buffer, true);
  }
}
