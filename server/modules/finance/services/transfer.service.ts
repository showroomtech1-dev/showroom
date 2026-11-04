import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { todayIn } from "../../../shared/utils/dates";
import { AuditService } from "../../audit/services/audit.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SettingsService } from "../../organization/services/settings.service";
import type { TransferDTO } from "../dto/finance.dto";
import { AccountRepository } from "../repositories/account.repository";
import { TransferRepository } from "../repositories/transfer.repository";
import type { CreateTransferInput, ListTransfersQuery } from "../validators/finance.schema";
import { LedgerService } from "./ledger.service";

export class TransferService {
  static Instance = new TransferService();
  private constructor(
    private readonly repo = TransferRepository.Instance,
    private readonly accounts = AccountRepository.Instance,
    private readonly ledger = LedgerService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async list(actor: Actor, query: ListTransfersQuery) {
    return this.repo.list(actor.organizationId, query);
  }

  async create(actor: Actor, data: CreateTransferInput): Promise<TransferDTO> {
    assertPermission(actor, "account.manage");
    const [from, to] = await Promise.all([
      this.accounts.findById(actor.organizationId, data.fromAccountId),
      this.accounts.findById(actor.organizationId, data.toAccountId),
    ]);
    if (!from || !from.isActive) throw AppError.badRequest("The source account was not found or is inactive");
    if (!to || !to.isActive) throw AppError.badRequest("The destination account was not found or is inactive");
    const { timezone } = await this.settings.get(actor.organizationId);
    const date = data.transferDate ?? todayIn(timezone);

    const id = await inTransaction(async (tx) => {
      const code = await this.codes.next(actor.organizationId, "transfer", tx);
      const transferId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          code,
          fromAccountId: from.id,
          toAccountId: to.id,
          amount: data.amount,
          transferDate: date,
          reference: data.reference ?? null,
          notes: data.notes ?? null,
          createdById: actor.id,
        },
        tx
      );
      const ref = { referenceType: "account_transfer", referenceId: transferId };
      await this.ledger.post(actor, actor.organizationId, { ...ref, accountId: from.id, branchId: from.branchId, date, direction: "out", amount: data.amount, type: "transfer_out", description: `${code} transfer to ${to.name}` }, tx);
      await this.ledger.post(actor, actor.organizationId, { ...ref, accountId: to.id, branchId: to.branchId, date, direction: "in", amount: data.amount, type: "transfer_in", description: `${code} transfer from ${from.name}` }, tx);
      await this.audit.log(actor, { action: "create", entityType: "account_transfer", entityId: transferId, summary: `${code}: moved ${data.amount} from ${from.name} to ${to.name}`, after: { ...data, code } }, tx);
      return transferId;
    });
    return (await this.repo.findById(actor.organizationId, id)) as TransferDTO;
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "account.manage");
    const transfer = await this.repo.findById(actor.organizationId, id);
    if (!transfer) throw AppError.notFound("Transfer not found");
    const { timezone } = await this.settings.get(actor.organizationId);
    await inTransaction(async (tx) => {
      await this.ledger.reverseReference(actor, "account_transfer", id, todayIn(timezone), `${transfer.code} transfer cancelled`, tx);
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "account_transfer", entityId: id, summary: `Cancelled transfer ${transfer.code}`, before: { ...transfer } }, tx);
    });
  }
}
