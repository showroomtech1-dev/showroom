// The single entry point for changing stock. Every change is an atomic quantity update plus a
// stock_movements row, inside the caller's transaction.
import { randomUUID } from "crypto";
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { resolveRange } from "../../../shared/utils/dates";
import { AuditService } from "../../audit/services/audit.service";
import { BranchService } from "../../organization/services/branch.service";
import { SettingsService } from "../../organization/services/settings.service";
import { VariantRepository } from "../../product/repositories/variant.repository";
import type { StockLevelRowDTO, StockMoveInput, ValuationDTO } from "../dto/inventory.dto";
import { StockRepository, type LevelFilter } from "../repositories/stock.repository";
import type { AdjustStockInput, ListLevelsQuery, ListMovementsQuery, TransferStockInput } from "../validators/inventory.schema";

export class StockService {
  static Instance = new StockService();
  private constructor(
    private readonly repo = StockRepository.Instance,
    private readonly variants = VariantRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  /**
   * Apply one stock change. Outgoing moves that would take stock below zero are refused unless the
   * business allows negative stock (or `allowNegative` is forced, e.g. reversing a received supply).
   */
  async move(actor: Actor | null, organizationId: string, m: StockMoveInput, tx: Tx, allowNegative?: boolean): Promise<number> {
    if (m.delta === 0) return this.repo.quantity(m.variantId, m.branchId, tx);
    const balance = await this.repo.applyDelta(organizationId, m.branchId, m.variantId, m.delta, tx);
    if (m.delta < 0 && balance < 0) {
      const permitted = allowNegative ?? (await this.settings.get(organizationId)).allowNegativeStock;
      if (!permitted) {
        throw AppError.conflict(`Not enough stock for ${m.label ?? "this item"} — only ${balance - m.delta} available`);
      }
    }
    await this.repo.insertMovement(organizationId, actor?.id ?? null, m, balance, tx);
    return balance;
  }

  /** Moving weighted-average cost update when goods arrive. Call BEFORE moving the stock in. */
  async receiveCost(variantId: string, quantity: number, unitCost: number, tx: Tx): Promise<void> {
    const { quantity: onHand, costPrice } = await this.repo.totalQuantityForUpdate(variantId, tx);
    const existing = Math.max(onHand, 0);
    const newCost = existing === 0 ? unitCost : Math.round((existing * costPrice + quantity * unitCost) / (existing + quantity));
    if (newCost !== costPrice) await this.variants.updateCost(variantId, newCost, tx);
  }

  private stripCost(actor: Actor, rows: StockLevelRowDTO[]): StockLevelRowDTO[] {
    if (can(actor, "product.viewcost")) return rows;
    return rows.map(({ costPrice: _c, valueAtCost: _v, ...rest }) => rest);
  }

  async levels(actor: Actor, query: ListLevelsQuery) {
    const filter: LevelFilter = { ...query, branchId: readBranchScope(actor, query.branchId) };
    const result = await this.repo.levels(actor.organizationId, filter);
    return { data: this.stripCost(actor, result.data), meta: result.meta };
  }

  async alertCounts(actor: Actor, branchId?: string) {
    return this.repo.alertCounts(actor.organizationId, readBranchScope(actor, branchId));
  }

  async movements(actor: Actor, query: ListMovementsQuery) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const range = query.from || query.to ? resolveRange(timezone, query.from, query.to) : null;
    const result = await this.repo.movements(actor.organizationId, {
      ...query,
      from: range?.from,
      to: range?.to,
      timezone,
      branchId: readBranchScope(actor, query.branchId),
    });
    if (can(actor, "product.viewcost")) return result;
    return { data: result.data.map(({ unitCost: _u, ...rest }) => rest), meta: result.meta };
  }

  async valuation(actor: Actor, branchId?: string): Promise<ValuationDTO> {
    const scope = readBranchScope(actor, branchId);
    const rows = await this.repo.valuation(actor.organizationId, scope);
    const showCost = can(actor, "product.viewcost");
    const valueAtCost = rows.reduce((s, r) => s + r.valueAtCost, 0);
    const valueAtSelling = rows.reduce((s, r) => s + r.valueAtSelling, 0);
    return {
      branchId: scope,
      totalUnits: rows.reduce((s, r) => s + r.units, 0),
      distinctItems: rows.reduce((s, r) => s + r.items, 0),
      valueAtCost: showCost ? valueAtCost : null,
      valueAtSelling,
      potentialMargin: showCost ? valueAtSelling - valueAtCost : null,
      byCategory: rows.map((r) => ({
        categoryName: r.categoryName,
        units: r.units,
        valueAtCost: showCost ? r.valueAtCost : null,
        valueAtSelling: r.valueAtSelling,
      })),
    };
  }

  /** Damage, theft, correction… A reason is mandatory and the change is logged + audited. */
  async adjust(actor: Actor, data: AdjustStockInput) {
    assertPermission(actor, "inventory.adjust");
    const branchId = await this.branches.resolveForWrite(actor, data.branchId);
    const variant = await this.variants.findForSale(actor.organizationId, data.variantId);
    if (!variant) throw AppError.notFound("Product variant not found");

    return inTransaction(async (tx) => {
      const current = await this.repo.quantity(variant.id, branchId, tx);
      const delta = data.mode === "set" ? data.quantity - current : data.quantity;
      if (delta === 0) throw AppError.badRequest("This adjustment would not change the stock level");
      const balance = await this.move(
        actor,
        actor.organizationId,
        {
          branchId,
          variantId: variant.id,
          productId: variant.productId,
          delta,
          type: "adjustment",
          unitCost: variant.costPrice,
          reason: data.reason,
          note: data.note,
          label: variant.label,
        },
        tx
      );
      await this.audit.log(
        actor,
        {
          action: "update",
          entityType: "stock_adjustment",
          entityId: variant.id,
          summary: `Stock ${delta > 0 ? "+" : ""}${delta} for ${variant.label} (${data.reason})`,
          before: { quantity: current },
          after: { quantity: balance, reason: data.reason, note: data.note ?? null, value: delta * variant.costPrice },
        },
        tx
      );
      return { variantId: variant.id, branchId, previousQuantity: current, quantity: balance, change: delta };
    });
  }

  /** Move stock from one branch to another. */
  async transfer(actor: Actor, data: TransferStockInput) {
    assertPermission(actor, "inventory.transfer");
    const fromBranch = await this.branches.resolveForWrite(actor, data.fromBranchId);
    const toBranch = await this.branches.get(actor, data.toBranchId);
    if (!toBranch.isActive) throw AppError.badRequest("The destination branch is inactive");
    if (fromBranch === toBranch.id) throw AppError.badRequest("Choose two different branches");

    const referenceId = randomUUID();
    await inTransaction(async (tx) => {
      for (const item of data.items) {
        const variant = await this.variants.findForSale(actor.organizationId, item.variantId, tx);
        if (!variant) throw AppError.notFound("Product variant not found");
        const base = { variantId: variant.id, productId: variant.productId, unitCost: variant.costPrice, note: data.note, referenceType: "stock_transfer", referenceId, label: variant.label };
        await this.move(actor, actor.organizationId, { ...base, branchId: fromBranch, delta: -item.quantity, type: "transfer_out" }, tx, false);
        await this.move(actor, actor.organizationId, { ...base, branchId: toBranch.id, delta: item.quantity, type: "transfer_in" }, tx);
      }
      await this.audit.log(actor, { action: "create", entityType: "stock_transfer", entityId: referenceId, summary: `Moved ${data.items.length} item(s) to ${toBranch.name}`, after: { fromBranch, toBranch: toBranch.id, items: data.items.length } }, tx);
    });
    return { referenceId, fromBranchId: fromBranch, toBranchId: toBranch.id, items: data.items };
  }
}
