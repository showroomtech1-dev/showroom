// Receipts: printable PDF, a public no-login link (unguessable token) and a WhatsApp share message.
import { env } from "../../../config/env";
import { AppError } from "../../../shared/errors/AppError";
import { FileResult } from "../../../shared/http/handler";
import type { Actor } from "../../../shared/types/actor";
import { formatMoney } from "../../../shared/utils/money";
import { renderReceipt, type ReceiptData } from "../../../shared/utils/pdf/receipt.pdf";
import { whatsappLink } from "../../../shared/utils/whatsapp";
import type { BusinessDTO } from "../../organization/dto/organization.dto";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import type { SaleHeaderDTO, SaleItemDTO, SalePaymentDTO } from "../dto/sale.dto";
import { SaleRepository } from "../repositories/sale.repository";
import { SaleService } from "./sale.service";

type Size = "thermal" | "a4";

export class ReceiptService {
  static Instance = new ReceiptService();
  private constructor(
    private readonly sales = SaleService.Instance,
    private readonly saleRepo = SaleRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance
  ) {}

  private async business(organizationId: string): Promise<BusinessDTO> {
    const [business, settings] = await Promise.all([this.organizations.findProfile(organizationId), this.organizations.findSettings(organizationId)]);
    if (!business || !settings) throw AppError.notFound("Business not found");
    return { business, settings };
  }

  private build(b: BusinessDTO, sale: SaleHeaderDTO, items: SaleItemDTO[], payments: SalePaymentDTO[]): ReceiptData {
    return {
      businessName: b.business.name,
      businessAddress: b.business.address,
      businessPhone: b.business.phone,
      taxNumber: b.settings.taxNumber,
      header: b.settings.receiptHeader,
      footer: b.settings.receiptFooter,
      currencySymbol: b.settings.currencySymbol,
      currencyCode: b.settings.currencyCode,
      timezone: b.settings.timezone,
      docTitle: sale.status === "voided" ? "RECEIPT — VOIDED" : "RECEIPT",
      code: sale.code,
      date: sale.soldAt,
      branchName: sale.branchName,
      servedBy: sale.soldByName,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      items: items.map((i) => ({
        name: i.variantName ? `${i.productName} (${i.variantName})` : i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        lineTotal: i.lineTotal,
      })),
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      taxName: b.settings.taxName,
      taxRateBps: sale.taxRateBps,
      taxAmount: sale.taxAmount,
      taxInclusive: b.settings.taxInclusive,
      total: sale.total,
      payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
      amountPaid: sale.amountPaid,
      balanceDue: sale.balanceDue,
      returnedAmount: sale.returnedAmount,
      notes: sale.notes,
      extraLines: sale.balanceDue > 0 && sale.dueDate ? [`Balance due by ${sale.dueDate}`] : [],
    };
  }

  async pdf(actor: Actor, saleId: string, size: Size): Promise<FileResult> {
    const sale = await this.sales.get(actor, saleId);
    const data = this.build(await this.business(actor.organizationId), sale, sale.items, sale.payments);
    return new FileResult(`receipt-${sale.code}.pdf`, "application/pdf", await renderReceipt(data, size), true);
  }

  async share(actor: Actor, saleId: string) {
    const sale = await this.sales.get(actor, saleId);
    const { business, settings } = await this.business(actor.organizationId);
    const receiptUrl = `${env.appUrl}/api/v1/public/receipts/${sale.receiptToken}`;
    const lines = [
      `Thank you for shopping with ${business.name}!`,
      `Receipt ${sale.code} — total ${formatMoney(sale.total, settings.currencySymbol)}.`,
      sale.balanceDue > 0 ? `Balance due: ${formatMoney(sale.balanceDue, settings.currencySymbol)}${sale.dueDate ? ` by ${sale.dueDate}` : ""}.` : "",
      `View your receipt: ${receiptUrl}`,
    ].filter(Boolean);
    const message = lines.join("\n");
    return { receiptUrl, message, whatsappUrl: whatsappLink(sale.customerPhone, message) };
  }

  /** Public, no login: anyone with the link (sent to the customer) can open the receipt. */
  async publicPdf(token: string, size: Size): Promise<FileResult> {
    const sale = await this.saleRepo.findByReceiptToken(token);
    if (!sale) throw AppError.notFound("Receipt not found");
    const [items, payments] = await Promise.all([this.saleRepo.items(sale.id), this.saleRepo.payments(sale.id)]);
    const data = this.build(await this.business(sale.organizationId), sale, items, payments);
    return new FileResult(`receipt-${sale.code}.pdf`, "application/pdf", await renderReceipt(data, size), true);
  }
}
