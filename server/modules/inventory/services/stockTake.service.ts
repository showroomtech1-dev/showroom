// Physical stock count: start (snapshot) → enter counts (any number of sessions) → complete
// (variances posted as `stock_take` movements against the quantity on hand at completion).
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { BranchService } from "../../organization/services/branch.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import type { StockTakeDTO } from "../dto/inventory.dto";
import { StockRepository } from "../repositories/stock.repository";
import { StockTakeRepository } from "../repositories/stockTake.repository";
import type { ListStockTakesQuery, RecordCountsInput, StartStockTakeInput, StockTakeItemsQuery } from "../validators/inventory.schema";
import { StockService } from "./stock.service";

export class StockTakeService {
  static Instance = new StockTakeService();
  private constructor(
    private readonly repo = StockTakeRepository.Instance,
    private readonly stockRepo = StockRepository.Instance,
    private readonly stock = StockService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private present(actor: Actor, take: StockTakeDTO): StockTakeDTO {
    if (can(actor, "product.viewcost")) return take;
    const { varianceValue: _v, ...rest } = take;
    return rest;
  }

  async list(actor: Actor, query: ListStockTakesQuery) {
    const result = await this.repo.list(actor.organizationId, { ...query, branchId: readBranchScope(actor, query.branchId) });
    return { data: result.data.map((t) => this.present(actor, t)), meta: result.meta };
  }

  async get(actor: Actor, id: string): Promise<StockTakeDTO> {
    const take = await this.repo.findById(actor.organizationId, id);
    if (!take) throw AppError.notFound("Stock take not found");
    readBranchScope(actor, take.branchId);
    return this.present(actor, take);
  }

  async items(actor: Actor, id: string, query: StockTakeItemsQuery) {
    await this.get(actor, id);
    const result = await this.repo.items(id, { ...query, uncountedOnly: query.uncountedOnly === "true" });
    if (can(actor, "product.viewcost")) return result;
    return { data: result.data.map(({ unitCost: _u, ...rest }) => rest), meta: result.meta };
  }

  async start(actor: Actor, data: StartStockTakeInput): Promise<StockTakeDTO> {
    assertPermission(actor, "stocktake.manage");
    const branchId = await this.branches.resolveForWrite(actor, data.branchId);
    const existing = await this.repo.findActiveByBranch(actor.organizationId, branchId);
    if (existing) {
      return this.present(actor, existing);
    }
    const id = await inTransaction(async (tx) => {
      const code = await this.codes.next(actor.organizationId, "stockTake", tx);
      const takeId = await this.repo.create({ organizationId: actor.organizationId, branchId, code, notes: data.notes ?? null, createdById: actor.id }, tx);
      const count = await this.repo.snapshotItems(takeId, actor.organizationId, branchId, data.categoryId, tx);
      if (count === 0) throw AppError.badRequest("There are no active products to count");
      await this.audit.log(actor, { action: "create", entityType: "stock_take", entityId: takeId, summary: `Started stock take ${code} (${count} items)` }, tx);
      return takeId;
    });
    return this.get(actor, id);
  }

  async recordCounts(actor: Actor, id: string, data: RecordCountsInput): Promise<StockTakeDTO> {
    assertPermission(actor, "stocktake.manage");
    const take = await this.get(actor, id);
    if (take.status !== "in_progress") throw AppError.badRequest("This stock take is already closed");
    await inTransaction(async (tx) => {
      const matched = await this.repo.recordCounts(id, data.counts, tx);
      if (matched !== data.counts.length) throw AppError.badRequest("Some items are not on this stock take's count sheet");
    });
    return this.get(actor, id);
  }

  async complete(actor: Actor, id: string): Promise<StockTakeDTO> {
    assertPermission(actor, "stocktake.manage");
    await inTransaction(async (tx) => {
      const take = await this.repo.findById(actor.organizationId, id, tx, true);
      if (!take) throw AppError.notFound("Stock take not found");
      readBranchScope(actor, take.branchId);
      if (take.status !== "in_progress") throw AppError.badRequest("This stock take is already closed");

      const counted = await this.repo.countedItems(id, tx);
      if (counted.length === 0) throw AppError.badRequest("Enter at least one count before completing");
      let varianceQuantity = 0;
      let varianceValue = 0;
      for (const item of counted) {
        // Compare with stock on hand NOW, so sales made during the count are not double-counted.
        const onHand = await this.stockRepo.quantity(item.variantId, take.branchId, tx);
        const variance = item.countedQuantity - onHand;
        await this.repo.setItemVariance(id, item.variantId, onHand, variance, tx);
        if (variance === 0) continue;
        varianceQuantity += variance;
        varianceValue += variance * item.unitCost;
        await this.stock.move(
          actor,
          actor.organizationId,
          { branchId: take.branchId, variantId: item.variantId, productId: item.productId, delta: variance, type: "stock_take", unitCost: item.unitCost, note: `Stock take ${take.code}`, referenceType: "stock_take", referenceId: id, label: item.label },
          tx,
          true
        );
      }
      await this.repo.finish(id, { status: "completed", completedAt: new Date(), completedById: actor.id, varianceQuantity, varianceValue, itemsCounted: counted.length }, tx);
      await this.audit.log(actor, { action: "approve", entityType: "stock_take", entityId: id, summary: `Completed stock take ${take.code}: variance ${varianceQuantity} units`, after: { varianceQuantity, varianceValue, itemsCounted: counted.length } }, tx);
    });
    return this.get(actor, id);
  }

  async cancel(actor: Actor, id: string): Promise<StockTakeDTO> {
    assertPermission(actor, "stocktake.manage");
    const take = await this.get(actor, id);
    if (take.status !== "in_progress") throw AppError.badRequest("This stock take is already closed");
    await inTransaction(async (tx) => {
      await this.repo.finish(id, { status: "cancelled", completedAt: new Date(), completedById: actor.id }, tx);
      await this.audit.log(actor, { action: "cancel", entityType: "stock_take", entityId: id, summary: `Cancelled stock take ${take.code}` }, tx);
    });
    return this.get(actor, id);
  }
}
