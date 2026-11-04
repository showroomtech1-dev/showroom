// Keeps supplies.amount_paid / payment_status and supplier_payments.allocated_amount in step.
// All methods run inside the caller's transaction and lock the rows they touch.
import type { Tx } from "../../../infrastructure/database/transaction";
import { SupplyRepository } from "../../supply/repositories/supply.repository";
import { SupplierPaymentRepository } from "../repositories/supplierPayment.repository";

export class PayableAllocationService {
  static Instance = new PayableAllocationService();
  private constructor(
    private readonly supplies = SupplyRepository.Instance,
    private readonly payments = SupplierPaymentRepository.Instance
  ) {}

  /** Applies up to `amount` of a payment to the supplier's unpaid supplies. Returns how much was applied. */
  async allocate(paymentId: string, supplierId: string, amount: number, preferredSupplyId: string | null, tx: Tx): Promise<number> {
    let remaining = amount;
    const open = await this.supplies.openForUpdate(supplierId, preferredSupplyId, tx);
    for (const supply of open) {
      if (remaining <= 0) break;
      const portion = Math.min(remaining, Number(supply.totalCost) - Number(supply.amountPaid));
      if (portion <= 0) continue;
      await this.payments.insertAllocation(paymentId, supply.id, portion, tx);
      await this.supplies.applyPaid(supply.id, portion, tx);
      remaining -= portion;
    }
    const applied = amount - remaining;
    if (applied > 0) await this.payments.applyAllocated(paymentId, applied, tx);
    return applied;
  }

  /** Applies every unused payment credit of a supplier to their unpaid supplies (oldest first). */
  async applyCredits(supplierId: string, tx: Tx): Promise<void> {
    const credits = await this.payments.withCreditForUpdate(supplierId, tx);
    for (const credit of credits) {
      const free = Number(credit.amount) - Number(credit.allocatedAmount);
      const applied = await this.allocate(credit.id, supplierId, free, null, tx);
      if (applied < free) break; // nothing left to pay
    }
  }

  /** Undo every allocation of a payment (payment deleted). */
  async releasePayment(paymentId: string, tx: Tx): Promise<void> {
    const rows = await this.payments.allocationsOfPayment(paymentId, tx);
    for (const row of rows) {
      await this.supplies.lock(row.supplyId, tx);
      await this.supplies.applyPaid(row.supplyId, -Number(row.amount), tx);
    }
    await this.payments.deleteAllocations(rows.map((r) => r.id), tx);
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    if (total > 0) await this.payments.applyAllocated(paymentId, -total, tx);
  }

  /** Undo every allocation against a supply (supply deleted) — the money becomes supplier credit. */
  async releaseSupply(supplyId: string, tx: Tx): Promise<void> {
    const rows = await this.payments.allocationsOfSupply(supplyId, tx);
    for (const row of rows) {
      await this.payments.lock(row.paymentId, tx);
      await this.payments.applyAllocated(row.paymentId, -Number(row.amount), tx);
    }
    await this.payments.deleteAllocations(rows.map((r) => r.id), tx);
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    if (total > 0) await this.supplies.applyPaid(supplyId, -total, tx);
  }
}
