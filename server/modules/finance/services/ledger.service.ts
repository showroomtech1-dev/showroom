// Every money movement in the system goes through here, inside the caller's transaction.
import { METHOD_ACCOUNT_TYPE } from "../../../config/constants";
import type { Tx } from "../../../infrastructure/database/transaction";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import type { LedgerEntryInput, PaymentTarget } from "../dto/finance.dto";
import { AccountRepository } from "../repositories/account.repository";
import { LedgerRepository } from "../repositories/ledger.repository";

const ACCOUNT_LABEL = { cash: "cash", bank: "bank", pos: "POS" } as const;

export class LedgerService {
  static Instance = new LedgerService();
  private constructor(
    private readonly accounts = AccountRepository.Instance,
    private readonly ledger = LedgerRepository.Instance
  ) {}

  /**
   * The money account a payment lands in: the chosen account (verified to be in this business
   * and active), or the default account for the payment method (cash → cash, transfer/cheque → bank, POS → POS).
   */
  async resolveAccount(actor: Actor, target: PaymentTarget, tx?: Tx): Promise<string> {
    if (target.accountId) {
      const account = await this.accounts.findById(actor.organizationId, target.accountId, tx);
      if (!account || !account.isActive) throw AppError.badRequest("The selected account was not found or is inactive");
      return account.id;
    }
    const type = METHOD_ACCOUNT_TYPE[target.method];
    const id = await this.accounts.findDefault(actor.organizationId, type, target.branchId ?? null, tx);
    if (!id) throw AppError.badRequest(`Set up a ${ACCOUNT_LABEL[type]} account in Settings → Accounts first`);
    return id;
  }

  async post(actor: Actor | null, organizationId: string, entry: LedgerEntryInput, tx: Tx): Promise<void> {
    if (entry.amount <= 0) return;
    await this.ledger.insert(organizationId, actor?.id ?? null, entry, tx);
  }

  /**
   * Cancels the money effect of a source record (a deleted payment, a voided sale…) by posting
   * offsetting `reversal` rows so its net effect on every account becomes zero. History is kept.
   */
  async reverseReference(
    actor: Actor,
    referenceType: string,
    referenceId: string,
    date: string,
    description: string,
    tx: Tx
  ): Promise<void> {
    const nets = await this.ledger.netByReference(actor.organizationId, referenceType, referenceId, tx);
    for (const { accountId, branchId, net } of nets) {
      const amount = Math.abs(Number(net));
      if (amount === 0) continue;
      await this.ledger.insert(
        actor.organizationId,
        actor.id,
        {
          accountId,
          branchId,
          date,
          direction: Number(net) > 0 ? "out" : "in",
          amount,
          type: "reversal",
          referenceType,
          referenceId,
          description,
        },
        tx
      );
    }
  }
}
