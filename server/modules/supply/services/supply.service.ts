// Goods received from suppliers (and bills from vendors). Receiving stock updates quantities and the
// weighted-average cost; any unused supplier credit is applied automatically.
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { addDays, todayIn } from "../../../shared/utils/dates";
import { allocateProportionally } from "../../../shared/utils/money";
import { AuditService } from "../../audit/services/audit.service";
import { StockService } from "../../inventory/services/stock.service";
import { BranchService } from "../../organization/services/branch.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import { VariantRepository } from "../../product/repositories/variant.repository";
import { SupplierRepository } from "../../supplier/repositories/supplier.repository";
import { PayableAllocationService } from "../../supplierPayment/services/payableAllocation.service";
import { SupplierPaymentService } from "../../supplierPayment/services/supplierPayment.service";
import type { SupplyDetailDTO } from "../dto/supply.dto";
import { SupplyRepository } from "../repositories/supply.repository";
import type { CreateSupplyInput, ListSuppliesQuery, UpdateSupplyInput } from "../validators/supply.schema";

export class SupplyService {
  static Instance = new SupplyService();
  private constructor(
    private readonly repo = SupplyRepository.Instance,
    private readonly suppliers = SupplierRepository.Instance,
    private readonly variants = VariantRepository.Instance,
    private readonly stock = StockService.Instance,
    private readonly allocation = PayableAllocationService.Instance,
    private readonly payments = SupplierPaymentService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private async today(actor: Actor): Promise<string> {
    return todayIn((await this.settings.get(actor.organizationId)).timezone);
  }

  async list(actor: Actor, query: ListSuppliesQuery) {
    return this.repo.list(actor.organizationId, { ...query, branchId: readBranchScope(actor, query.branchId) }, await this.today(actor));
  }

  async get(actor: Actor, id: string): Promise<SupplyDetailDTO> {
    const supply = await this.repo.findById(actor.organizationId, id, await this.today(actor));
    if (!supply) throw AppError.notFound("Supply not found");
    const [items, payments] = await Promise.all([this.repo.items(id), this.repo.allocations(id)]);
    return { ...supply, items, payments };
  }

  async create(actor: Actor, data: CreateSupplyInput): Promise<SupplyDetailDTO> {
    assertPermission(actor, "supply.manage");
    if (data.payment) assertPermission(actor, "supplierpayment.manage", "You can record the supply, but not a payment");
    const settings = await this.settings.get(actor.organizationId);
    const supplier = await this.suppliers.findById(actor.organizationId, data.supplierId);
    if (!supplier) throw AppError.badRequest("Supplier not found");
    if (!supplier.isActive) throw AppError.badRequest(`${supplier.name} is marked inactive`);
    const branchId = await this.branches.resolveForWrite(actor, data.branchId);
    const supplyDate = data.supplyDate ?? todayIn(settings.timezone);

    const variantIds = data.items.map((i) => i.variantId).filter((v): v is string => Boolean(v));
    const variants = await this.variants.findManyForSale(actor.organizationId, variantIds);
    for (const id of variantIds) if (!variants.has(id)) throw AppError.badRequest("One of the products was not found");

    const lineTotals = data.items.map((i) => i.quantity * i.unitCost);
    const subtotal = lineTotals.reduce((a, b) => a + b, 0);
    if (data.discount > subtotal) throw AppError.badRequest("The discount cannot be more than the subtotal");
    const totalCost = subtotal - data.discount;
    if (data.payment && data.payment.amount > totalCost) {
      // Paying more than the supply total here is almost always a typo. A deliberate advance can still
      // be recorded as a separate supplier payment (it is then flagged as an over-payment).
      throw AppError.badRequest("The payment is more than this supply's total. Record the extra as a separate payment if intended.");
    }
    const fullyPaidNow = data.payment?.amount === totalCost;
    const dueDate =
      data.dueDate !== undefined
        ? data.dueDate
        : fullyPaidNow
          ? null
          : addDays(supplyDate, supplier.paymentTermsDays ?? settings.defaultCreditDays);
    const discountShares = allocateProportionally(data.discount, lineTotals);

    const id = await inTransaction(async (tx) => {
      const code = await this.codes.next(actor.organizationId, "supply", tx);
      const supplyId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          branchId,
          supplierId: supplier.id,
          code,
          invoiceNumber: data.invoiceNumber ?? null,
          supplyDate,
          dueDate,
          subtotal,
          discount: data.discount,
          totalCost,
          amountPaid: 0,
          paymentStatus: totalCost === 0 ? "paid" : "credit",
          notes: data.notes ?? null,
          createdById: actor.id,
        },
        tx
      );

      await this.repo.insertItems(
        data.items.map((item, i) => {
          const variant = item.variantId ? variants.get(item.variantId) : undefined;
          return {
            supplyId,
            variantId: variant?.id ?? null,
            productId: variant?.productId ?? null,
            description: (item.description || variant?.label || "Item").slice(0, 200),
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: lineTotals[i],
          };
        }),
        tx
      );

      for (const [i, item] of data.items.entries()) {
        const variant = item.variantId ? variants.get(item.variantId) : undefined;
        if (!variant) continue;
        // Landed unit cost after the supply discount, used for stock valuation and COGS.
        const effectiveUnitCost = Math.round((lineTotals[i] - discountShares[i]) / item.quantity);
        await this.stock.receiveCost(variant.id, item.quantity, effectiveUnitCost, tx);
        await this.stock.move(
          actor,
          actor.organizationId,
          { branchId, variantId: variant.id, productId: variant.productId, delta: item.quantity, type: "supply", unitCost: effectiveUnitCost, referenceType: "supply", referenceId: supplyId, note: `${code} from ${supplier.name}`, label: variant.label },
          tx
        );
      }

      if (data.payment) {
        await this.payments.recordInTx(
          actor,
          { supplierId: supplier.id, supplyId, branchId, amount: data.payment.amount, method: data.payment.method, accountId: data.payment.accountId, reference: data.payment.reference, paymentDate: supplyDate },
          tx
        );
      }
      // Any earlier over-payment / credit with this supplier now goes against this supply.
      await this.allocation.applyCredits(supplier.id, tx);

      await this.audit.log(
        actor,
        {
          action: "create",
          entityType: "supply",
          entityId: supplyId,
          summary: `${code}: received ${data.items.length} line(s) from ${supplier.name}`,
          after: { totalCost, subtotal, discount: data.discount, supplyDate, dueDate, invoiceNumber: data.invoiceNumber ?? null, paidNow: data.payment?.amount ?? 0 },
        },
        tx
      );
      return supplyId;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateSupplyInput): Promise<SupplyDetailDTO> {
    assertPermission(actor, "supply.manage");
    const before = await this.get(actor, id);
    readBranchScope(actor, before.branchId);
    const supplyDate = data.supplyDate ?? before.supplyDate;
    const dueDate = data.dueDate !== undefined ? data.dueDate : before.dueDate;
    if (dueDate && dueDate < supplyDate) throw AppError.badRequest("Due date cannot be before the supply date");
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, data, tx);
      await this.audit.log(
        actor,
        { action: "update", entityType: "supply", entityId: id, summary: `Updated supply ${before.code}`, before: { invoiceNumber: before.invoiceNumber, supplyDate: before.supplyDate, dueDate: before.dueDate, notes: before.notes }, after: data },
        tx
      );
    });
    return this.get(actor, id);
  }

  /**
   * Deleting a supply takes its goods back out of stock (refused if they've already been sold,
   * unless negative stock is allowed) and turns any payment against it into supplier credit.
   */
  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "supply.manage");
    const supply = await this.get(actor, id);
    readBranchScope(actor, supply.branchId);
    await inTransaction(async (tx) => {
      await this.repo.lock(id, tx);
      for (const item of supply.items) {
        if (!item.variantId || !item.productId) continue;
        await this.stock.move(
          actor,
          actor.organizationId,
          { branchId: supply.branchId, variantId: item.variantId, productId: item.productId, delta: -item.quantity, type: "supply_reversal", unitCost: item.unitCost, referenceType: "supply", referenceId: id, note: `${supply.code} deleted`, label: item.description },
          tx
        );
      }
      await this.allocation.releaseSupply(id, tx);
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.allocation.applyCredits(supply.supplierId, tx);
      await this.audit.log(actor, { action: "delete", entityType: "supply", entityId: id, summary: `Deleted supply ${supply.code} from ${supply.supplierName}`, before: { totalCost: supply.totalCost, amountPaid: supply.amountPaid, supplyDate: supply.supplyDate } }, tx);
    });
  }
}
