// Returns & refunds. The value of returned goods first clears what the customer still owes on the
// sale; anything beyond that is refunded in money. Restocked items go back into stock (and out of COGS).
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { todayIn } from "../../../shared/utils/dates";
import { applyBps, formatMoney } from "../../../shared/utils/money";
import { AuditService } from "../../audit/services/audit.service";
import { LedgerService } from "../../finance/services/ledger.service";
import { StockService } from "../../inventory/services/stock.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import { returnValue } from "../domain/pricing";
import type { SaleReturnDTO } from "../dto/sale.dto";
import { SaleRepository } from "../repositories/sale.repository";
import { SaleReturnRepository } from "../repositories/saleReturn.repository";
import type { CreateReturnInput, ListReturnsQuery } from "../validators/sale.schema";

export class SaleReturnService {
  static Instance = new SaleReturnService();
  private constructor(
    private readonly repo = SaleReturnRepository.Instance,
    private readonly sales = SaleRepository.Instance,
    private readonly stock = StockService.Instance,
    private readonly ledger = LedgerService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private present(actor: Actor, r: SaleReturnDTO): SaleReturnDTO {
    if (can(actor, "product.viewcost")) return r;
    const { costReversed: _c, ...rest } = r;
    return rest;
  }

  async list(actor: Actor, query: ListReturnsQuery) {
    const result = await this.repo.list(actor.organizationId, { ...query, branchId: readBranchScope(actor, query.branchId) });
    return { data: result.data.map((r) => this.present(actor, r)), meta: result.meta };
  }

  async get(actor: Actor, id: string): Promise<SaleReturnDTO> {
    const ret = await this.repo.findById(actor.organizationId, id);
    if (!ret) throw AppError.notFound("Return not found");
    readBranchScope(actor, ret.branchId);
    return this.present(actor, { ...ret, items: await this.repo.items(id) });
  }

  async create(actor: Actor, data: CreateReturnInput): Promise<SaleReturnDTO> {
    assertPermission(actor, "sale.return");
    const settings = await this.settings.get(actor.organizationId);
    const returnDate = data.returnDate ?? todayIn(settings.timezone);

    const id = await inTransaction(async (tx) => {
      await this.sales.lock(data.saleId, tx);
      const sale = await this.sales.findById(actor.organizationId, data.saleId, tx);
      if (!sale) throw AppError.notFound("Sale not found");
      readBranchScope(actor, sale.branchId);
      if (sale.status !== "completed") throw AppError.badRequest("Only completed sales can be returned");
      const saleItems = new Map((await this.sales.items(sale.id, tx)).map((i) => [i.id, i]));

      const seen = new Set<string>();
      const lines = data.items.map((line) => {
        const item = saleItems.get(line.saleItemId);
        if (!item) throw AppError.badRequest("An item is not part of this sale");
        if (seen.has(item.id)) throw AppError.badRequest("Each sale line can appear only once");
        seen.add(item.id);
        const returnable = item.quantity - item.returnedQuantity;
        if (line.quantity > returnable) {
          throw AppError.badRequest(`Only ${returnable} of ${item.productName} can still be returned`);
        }
        const lineValue = returnValue(item.lineTotal, item.quantity, line.quantity, sale.subtotal, sale.total);
        return { line, item, lineValue };
      });

      // Never refund more than what is left of the sale after earlier returns.
      const remaining = sale.total - sale.returnedAmount;
      const totalValue = Math.min(lines.reduce((s, l) => s + l.lineValue, 0), remaining);
      if (totalValue <= 0) throw AppError.badRequest("Nothing left to return on this sale");
      const taxReversed = sale.total > 0 ? Math.round((totalValue * sale.taxAmount) / sale.total) : 0;
      const costReversed = lines.reduce((s, l) => s + (l.line.restock ? l.line.quantity * (l.item.unitCost ?? 0) : 0), 0);
      const appliedToBalance = Math.min(totalValue, sale.balanceDue);
      const refundAmount = totalValue - appliedToBalance;

      const code = await this.codes.next(actor.organizationId, "saleReturn", tx);
      const accountId = refundAmount > 0 ? await this.ledger.resolveAccount(actor, { method: data.refundMethod, accountId: data.accountId, branchId: sale.branchId }, tx) : null;
      const returnId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          branchId: sale.branchId,
          saleId: sale.id,
          code,
          returnDate,
          reason: data.reason ?? null,
          totalValue,
          taxReversed,
          costReversed,
          appliedToBalance,
          refundAmount,
          refundMethod: refundAmount > 0 ? data.refundMethod : null,
          accountId,
          processedById: actor.id,
        },
        tx
      );
      await this.repo.insertItems(
        lines.map((l) => ({ returnId, saleItemId: l.item.id, variantId: l.item.variantId, quantity: l.line.quantity, lineValue: l.lineValue, unitCost: l.item.unitCost ?? 0, restock: l.line.restock })),
        tx
      );

      for (const l of lines) {
        await this.sales.addReturnedQuantity(l.item.id, l.line.quantity, tx);
        if (l.line.restock) {
          await this.stock.move(
            actor,
            actor.organizationId,
            { branchId: sale.branchId, variantId: l.item.variantId, productId: l.item.productId, delta: l.line.quantity, type: "sale_return", unitCost: l.item.unitCost ?? 0, referenceType: "sale_return", referenceId: returnId, note: `${code} for ${sale.code}`, label: l.item.productName },
            tx
          );
        }
      }

      // Returned value reduces what the customer owes, then the sale's commission is recalculated.
      const returnedAmount = sale.returnedAmount + totalValue;
      const netRemaining = sale.total > 0 ? Math.round(((sale.total - returnedAmount) * (sale.total - sale.taxAmount)) / sale.total) : 0;
      if (appliedToBalance > 0) await this.sales.reduceBalance(sale.id, appliedToBalance, tx);
      await this.sales.update(sale.id, { returnedAmount, commissionAmount: applyBps(Math.max(netRemaining, 0), sale.commissionRateBps) }, tx);

      if (refundAmount > 0 && accountId) {
        await this.ledger.post(
          actor,
          actor.organizationId,
          { accountId, branchId: sale.branchId, date: returnDate, direction: "out", amount: refundAmount, type: "sale_refund", referenceType: "sale_return", referenceId: returnId, description: `${code} refund for ${sale.code}` },
          tx
        );
      }
      await this.audit.log(
        actor,
        {
          action: "create",
          entityType: "sale_return",
          entityId: returnId,
          summary: `${code}: return on ${sale.code} worth ${formatMoney(totalValue, settings.currencySymbol)}${refundAmount > 0 ? `, refunded ${formatMoney(refundAmount, settings.currencySymbol)}` : ""}`,
          after: { totalValue, appliedToBalance, refundAmount, taxReversed, costReversed, reason: data.reason ?? null },
        },
        tx
      );
      return returnId;
    });
    return this.get(actor, id);
  }
}
