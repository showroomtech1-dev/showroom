import { STORAGE_FOLDERS } from "../../../config/constants";
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import { StorageService } from "../../../shared/services/storage.service";
import type { Actor } from "../../../shared/types/actor";
import { todayIn } from "../../../shared/utils/dates";
import { formatMoney } from "../../../shared/utils/money";
import { AuditService } from "../../audit/services/audit.service";
import { LedgerService } from "../../finance/services/ledger.service";
import { BranchService } from "../../organization/services/branch.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import { SupplierRepository } from "../../supplier/repositories/supplier.repository";
import { SupplyRepository } from "../../supply/repositories/supply.repository";
import type { RecordPaymentResultDTO, SupplierPaymentDetailDTO } from "../dto/supplierPayment.dto";
import { SupplierPaymentRepository } from "../repositories/supplierPayment.repository";
import type { CreateSupplierPaymentInput, ListSupplierPaymentsQuery, UpdateSupplierPaymentInput } from "../validators/supplierPayment.schema";
import { PayableAllocationService } from "./payableAllocation.service";

export class SupplierPaymentService {
  static Instance = new SupplierPaymentService();
  private constructor(
    private readonly repo = SupplierPaymentRepository.Instance,
    private readonly suppliers = SupplierRepository.Instance,
    private readonly supplies = SupplyRepository.Instance,
    private readonly allocation = PayableAllocationService.Instance,
    private readonly ledger = LedgerService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly storage = StorageService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async list(actor: Actor, query: ListSupplierPaymentsQuery) {
    return this.repo.list(actor.organizationId, query);
  }

  async get(actor: Actor, id: string, tx?: Tx): Promise<SupplierPaymentDetailDTO> {
    const payment = await this.repo.findById(actor.organizationId, id, tx);
    if (!payment) throw AppError.notFound("Payment not found");
    return { ...payment, allocations: await this.repo.allocations(id, tx) };
  }

  /**
   * Records a payment inside an existing transaction (used directly and when a supply is recorded
   * with an up-front payment). Allocates it, posts it to the money ledger and audits it.
   */
  async recordInTx(actor: Actor, data: CreateSupplierPaymentInput, tx: Tx): Promise<{ id: string; overpaid: number }> {
    const { timezone } = await this.settings.get(actor.organizationId);
    const date = data.paymentDate ?? todayIn(timezone);
    const supplier = await this.suppliers.findById(actor.organizationId, data.supplierId, tx);
    if (!supplier) throw AppError.badRequest("Supplier not found");
    const accountId = await this.ledger.resolveAccount(actor, { method: data.method, accountId: data.accountId, branchId: data.branchId }, tx);
    const code = await this.codes.next(actor.organizationId, "supplierPayment", tx);

    const id = await this.repo.create(
      {
        organizationId: actor.organizationId,
        supplierId: supplier.id,
        branchId: data.branchId ?? actor.branchId,
        code,
        paymentDate: date,
        amount: data.amount,
        method: data.method,
        accountId,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
        proofUrl: null,
        proofPublicId: null,
        allocatedAmount: 0,
        isOverpayment: false,
        overpaidAmount: data.amount,
        clientRef: data.clientRef ?? null,
        createdById: actor.id,
      },
      tx
    );
    const applied = await this.allocation.allocate(id, supplier.id, data.amount, data.supplyId ?? null, tx);
    const overpaid = data.amount - applied;
    if (overpaid > 0) await this.repo.update(actor.organizationId, id, { isOverpayment: true }, tx);

    await this.ledger.post(
      actor,
      actor.organizationId,
      {
        accountId,
        branchId: data.branchId ?? actor.branchId,
        date,
        direction: "out",
        amount: data.amount,
        type: "supplier_payment",
        referenceType: "supplier_payment",
        referenceId: id,
        description: `${code} payment to ${supplier.name}${data.reference ? ` (ref ${data.reference})` : ""}`,
      },
      tx
    );
    await this.audit.log(
      actor,
      {
        action: "create",
        entityType: "supplier_payment",
        entityId: id,
        summary: `${code}: paid ${supplier.name}${overpaid > 0 ? " — OVERPAYMENT" : ""}`,
        after: { amount: data.amount, method: data.method, date, applied, overpaid, supplyId: data.supplyId ?? null },
      },
      tx
    );
    return { id, overpaid };
  }

  async create(actor: Actor, data: CreateSupplierPaymentInput): Promise<RecordPaymentResultDTO> {
    assertPermission(actor, "supplierpayment.manage");
    if (data.clientRef) {
      const existing = await this.repo.findByClientRef(actor.organizationId, data.clientRef);
      if (existing) return { payment: await this.get(actor, existing.id), warning: null };
    }
    if (data.branchId) data = { ...data, branchId: await this.branches.resolveForWrite(actor, data.branchId) };
    if (data.supplyId) {
      const { timezone } = await this.settings.get(actor.organizationId);
      const supply = await this.supplies.findById(actor.organizationId, data.supplyId, todayIn(timezone));
      if (!supply || supply.supplierId !== data.supplierId) throw AppError.badRequest("That supply does not belong to this supplier");
    }
    const { id, overpaid } = await inTransaction((tx) => this.recordInTx(actor, data, tx));
    const { currencySymbol } = await this.settings.get(actor.organizationId);
    return {
      payment: await this.get(actor, id),
      warning:
        overpaid > 0
          ? `This payment is ${formatMoney(overpaid, currencySymbol)} more than what was owed. The extra is kept as a credit with the supplier and will be applied to their next supply.`
          : null,
    };
  }

  async update(actor: Actor, id: string, data: UpdateSupplierPaymentInput): Promise<SupplierPaymentDetailDTO> {
    assertPermission(actor, "supplierpayment.manage");
    const before = await this.get(actor, id);
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, data, tx);
      await this.audit.log(actor, { action: "update", entityType: "supplier_payment", entityId: id, summary: `Updated payment ${before.code}`, before: { reference: before.reference, notes: before.notes }, after: data }, tx);
    });
    return this.get(actor, id);
  }

  /** Deleting reverses the money movement and un-pays the supplies it covered. */
  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "supplierpayment.manage");
    const payment = await this.get(actor, id);
    const { timezone } = await this.settings.get(actor.organizationId);
    await inTransaction(async (tx) => {
      await this.repo.lock(id, tx);
      await this.allocation.releasePayment(id, tx);
      await this.ledger.reverseReference(actor, "supplier_payment", id, todayIn(timezone), `${payment.code} payment deleted`, tx);
      await this.repo.softDelete(actor.organizationId, id, tx);
      // Other unused credits may now cover the supplies this payment had covered.
      await this.allocation.applyCredits(payment.supplierId, tx);
      await this.audit.log(actor, { action: "delete", entityType: "supplier_payment", entityId: id, summary: `Deleted payment ${payment.code} to ${payment.supplierName}`, before: { ...payment } }, tx);
    });
  }

  async uploadProof(actor: Actor, id: string, file: { buffer: Buffer; mimetype: string }): Promise<SupplierPaymentDetailDTO> {
    assertPermission(actor, "supplierpayment.manage");
    const payment = await this.get(actor, id);
    const { url, publicId } = await this.storage.replace(
      file.buffer,
      { folder: STORAGE_FOLDERS.supplierPayment, kind: file.mimetype.startsWith("image/") ? "image" : "document" },
      payment.proofPublicId
    );
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, { proofUrl: url, proofPublicId: publicId }, tx);
      await this.audit.log(actor, { action: "update", entityType: "supplier_payment", entityId: id, summary: `Attached proof to ${payment.code}` }, tx);
    });
    return this.get(actor, id);
  }
}
