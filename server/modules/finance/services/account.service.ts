import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { addDays, resolveRange } from "../../../shared/utils/dates";
import { AuditService } from "../../audit/services/audit.service";
import { BranchService } from "../../organization/services/branch.service";
import { SettingsService } from "../../organization/services/settings.service";
import type { AccountDTO, AccountOptionDTO, AccountStatementDTO } from "../dto/finance.dto";
import { AccountRepository } from "../repositories/account.repository";
import { LedgerRepository } from "../repositories/ledger.repository";
import type { CreateAccountInput, UpdateAccountInput } from "../validators/finance.schema";

export class AccountService {
  static Instance = new AccountService();
  private constructor(
    private readonly repo = AccountRepository.Instance,
    private readonly ledger = LedgerRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async list(actor: Actor, query: { branchId?: string; includeInactive?: boolean }): Promise<AccountDTO[]> {
    return this.repo.list(actor.organizationId, { branchId: readBranchScope(actor, query.branchId), includeInactive: query.includeInactive });
  }

  /** Picker list for payment screens — names only, no balances. */
  async options(actor: Actor): Promise<AccountOptionDTO[]> {
    return this.repo.options(actor.organizationId);
  }

  async get(actor: Actor, id: string): Promise<AccountDTO> {
    const account = await this.repo.findById(actor.organizationId, id);
    if (!account) throw AppError.notFound("Account not found");
    return account;
  }

  async create(actor: Actor, data: CreateAccountInput): Promise<AccountDTO> {
    assertPermission(actor, "account.manage");
    if (data.branchId) await this.branches.get(actor, data.branchId);
    const id = await inTransaction(async (tx) => {
      if (data.isDefault) await this.repo.clearDefault(actor.organizationId, data.type, tx);
      const accountId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          branchId: data.branchId ?? null,
          name: data.name,
          type: data.type,
          bankName: data.bankName ?? null,
          accountNumber: data.accountNumber ?? null,
          openingBalance: data.openingBalance,
          isDefault: data.isDefault,
          isActive: true,
          notes: data.notes ?? null,
        },
        tx
      );
      await this.audit.log(actor, { action: "create", entityType: "account", entityId: accountId, summary: `Created ${data.type} account ${data.name}`, after: { ...data } }, tx);
      return accountId;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateAccountInput): Promise<AccountDTO> {
    assertPermission(actor, "account.manage");
    const before = await this.get(actor, id);
    if (data.branchId) await this.branches.get(actor, data.branchId);
    await inTransaction(async (tx) => {
      if (data.isDefault) await this.repo.clearDefault(actor.organizationId, before.type, tx);
      await this.repo.update(actor.organizationId, id, data, tx);
      await this.audit.log(actor, { action: "update", entityType: "account", entityId: id, summary: `Updated account ${before.name}`, before: { ...before }, after: data }, tx);
    });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "account.manage");
    const account = await this.get(actor, id);
    if (await this.repo.hasTransactions(id)) {
      throw AppError.conflict("This account has transactions. Deactivate it instead so its history is kept.");
    }
    await inTransaction(async (tx) => {
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "account", entityId: id, summary: `Deleted account ${account.name}`, before: { ...account } }, tx);
    });
  }

  async statement(actor: Actor, id: string, query: { from?: string; to?: string }): Promise<AccountStatementDTO> {
    const account = await this.get(actor, id);
    readBranchScope(actor, account.branchId ?? undefined);
    const { timezone } = await this.settings.get(actor.organizationId);
    const { from, to } = resolveRange(timezone, query.from, query.to);
    const openingBalance = await this.ledger.balanceAt(id, addDays(from, -1));
    const rows = await this.ledger.statementRows(id, from, to, openingBalance);
    const totalIn = rows.filter((r) => r.direction === "in").reduce((s, r) => s + Number(r.amount), 0);
    const totalOut = rows.filter((r) => r.direction === "out").reduce((s, r) => s + Number(r.amount), 0);
    return { account, from, to, openingBalance, totalIn, totalOut, closingBalance: openingBalance + totalIn - totalOut, rows };
  }
}
