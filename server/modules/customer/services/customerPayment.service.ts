import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { todayIn } from "../../../shared/utils/dates";
import { formatMoney } from "../../../shared/utils/money";
import { AuditService } from "../../audit/services/audit.service";
import { LedgerService } from "../../finance/services/ledger.service";
import { BranchService } from "../../organization/services/branch.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import { SaleRepository } from "../../sale/repositories/sale.repository";
import type { CustomerPaymentDTO } from "../dto/customer.dto";
import { CustomerRepository } from "../repositories/customer.repository";
import { CustomerPaymentRepository } from "../repositories/customerPayment.repository";
import type { CreateCustomerPaymentInput, ListCustomerPaymentsQuery } from "../validators/customer.schema";
import { ReceivableAllocationService } from "./receivableAllocation.service";

export class CustomerPaymentService {
  static Instance = new CustomerPaymentService();
  private constructor(
    private readonly repo = CustomerPaymentRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly sales = SaleRepository.Instance,
    private readonly allocation = ReceivableAllocationService.Instance,
    private readonly ledger = LedgerService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async list(actor: Actor, query: ListCustomerPaymentsQuery) {
    return this.repo.list(actor.organizationId, { ...query, branchId: readBranchScope(actor, query.branchId) });
  }

  async get(actor: Actor, id: string): Promise<CustomerPaymentDTO> {
    const payment = await this.repo.findById(actor.organizationId, id);
    if (!payment) throw AppError.notFound("Payment not found");
    return { ...payment, allocations: await this.repo.allocations(id) };
  }

  async create(actor: Actor, data: CreateCustomerPaymentInput): Promise<{ payment: CustomerPaymentDTO; warning: string | null }> {
    assertPermission(actor, "customerpayment.create");
    if (data.clientRef) {
      const existing = await this.repo.findIdByClientRef(actor.organizationId, data.clientRef);
      if (existing) return { payment: await this.get(actor, existing), warning: null };
    }
    const settings = await this.settings.get(actor.organizationId);
    const customer = await this.customers.findById(actor.organizationId, data.customerId);
    if (!customer) throw AppError.badRequest("Customer not found");
    if (data.saleId) {
      const sale = await this.sales.findById(actor.organizationId, data.saleId);
      if (!sale || sale.customerId !== customer.id) throw AppError.badRequest("That sale does not belong to this customer");
    }
    const branchId = await this.branches.resolveForWrite(actor, data.branchId);
    const date = data.paymentDate ?? todayIn(settings.timezone);

    const { id, unapplied } = await inTransaction(async (tx) => {
      const accountId = await this.ledger.resolveAccount(actor, { method: data.method, accountId: data.accountId, branchId }, tx);
      const code = await this.codes.next(actor.organizationId, "customerPayment", tx);
      const paymentId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          customerId: customer.id,
          branchId,
          code,
          paymentDate: date,
          amount: data.amount,
          method: data.method,
          accountId,
          reference: data.reference ?? null,
          notes: data.notes ?? null,
          allocatedAmount: 0,
          clientRef: data.clientRef ?? null,
          createdById: actor.id,
        },
        tx
      );
      const applied = await this.allocation.allocate(paymentId, customer.id, data.amount, data.saleId ?? null, tx);
      await this.ledger.post(
        actor,
        actor.organizationId,
        { accountId, branchId, date, direction: "in", amount: data.amount, type: "customer_payment", referenceType: "customer_payment", referenceId: paymentId, description: `${code} payment from ${customer.name}` },
        tx
      );
      await this.audit.log(actor, { action: "create", entityType: "customer_payment", entityId: paymentId, summary: `${code}: ${customer.name} paid`, after: { amount: data.amount, method: data.method, date, applied } }, tx);
      return { id: paymentId, unapplied: data.amount - applied };
    });
    return {
      payment: await this.get(actor, id),
      warning:
        unapplied > 0
          ? `${formatMoney(unapplied, settings.currencySymbol)} is more than ${customer.name} owed. It is kept as credit and will be used on their next credit purchase.`
          : null,
    };
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "customerpayment.delete");
    const payment = await this.get(actor, id);
    readBranchScope(actor, payment.branchId);
    const { timezone } = await this.settings.get(actor.organizationId);
    await inTransaction(async (tx) => {
      await this.repo.lock(id, tx);
      await this.allocation.releasePayment(id, tx);
      await this.ledger.reverseReference(actor, "customer_payment", id, todayIn(timezone), `${payment.code} payment deleted`, tx);
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.allocation.applyCredits(payment.customerId, tx);
      await this.audit.log(actor, { action: "delete", entityType: "customer_payment", entityId: id, summary: `Deleted payment ${payment.code} from ${payment.customerName}`, before: { ...payment, allocations: undefined } }, tx);
    });
  }
}
