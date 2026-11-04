// Keeps sales.amount_paid / balance_due and customer_payments.allocated_amount in step.
// Runs inside the caller's transaction; rows are locked before they are changed.
import type { Tx } from "../../../infrastructure/database/transaction";
import { SaleRepository } from "../../sale/repositories/sale.repository";
import { CustomerPaymentRepository } from "../repositories/customerPayment.repository";

export class ReceivableAllocationService {
  static Instance = new ReceivableAllocationService();
  private constructor(
    private readonly sales = SaleRepository.Instance,
    private readonly payments = CustomerPaymentRepository.Instance
  ) {}

  async allocate(paymentId: string, customerId: string, amount: number, preferredSaleId: string | null, tx: Tx): Promise<number> {
    let remaining = amount;
    for (const sale of await this.sales.openForUpdate(customerId, preferredSaleId, tx)) {
      if (remaining <= 0) break;
      const portion = Math.min(remaining, Number(sale.balanceDue));
      if (portion <= 0) continue;
      await this.payments.insertAllocation(paymentId, sale.id, portion, tx);
      await this.sales.applyPaid(sale.id, portion, tx);
      remaining -= portion;
    }
    const applied = amount - remaining;
    if (applied > 0) await this.payments.applyAllocated(paymentId, applied, tx);
    return applied;
  }

  /** Applies a customer's unused payment credit to their unpaid sales. Returns the amount applied. */
  async applyCredits(customerId: string, tx: Tx): Promise<number> {
    let total = 0;
    for (const credit of await this.payments.withCreditForUpdate(customerId, tx)) {
      const free = Number(credit.amount) - Number(credit.allocatedAmount);
      const applied = await this.allocate(credit.id, customerId, free, null, tx);
      total += applied;
      if (applied < free) break;
    }
    return total;
  }

  async releasePayment(paymentId: string, tx: Tx): Promise<void> {
    const rows = await this.payments.allocationsOfPayment(paymentId, tx);
    for (const row of rows) {
      await this.sales.lock(row.saleId, tx);
      await this.sales.applyPaid(row.saleId, -Number(row.amount), tx);
    }
    await this.payments.deleteAllocations(rows.map((r) => r.id), tx);
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    if (total > 0) await this.payments.applyAllocated(paymentId, -total, tx);
  }

  /** Detach later payments from a sale (sale voided): the money becomes customer credit. */
  async releaseSale(saleId: string, tx: Tx): Promise<number> {
    const rows = await this.payments.allocationsOfSale(saleId, tx);
    for (const row of rows) {
      await this.payments.lock(row.paymentId, tx);
      await this.payments.applyAllocated(row.paymentId, -Number(row.amount), tx);
    }
    await this.payments.deleteAllocations(rows.map((r) => r.id), tx);
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    if (total > 0) await this.sales.applyPaid(saleId, -total, tx);
    return total;
  }
}
