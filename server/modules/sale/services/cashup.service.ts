// Daily sales summary and end-of-day cash reconciliation ("cash-up").
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { ownSalesOnly, readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { resolveRange, todayIn } from "../../../shared/utils/dates";
import { formatMoney } from "../../../shared/utils/money";
import { AuditService } from "../../audit/services/audit.service";
import { AccountRepository } from "../../finance/repositories/account.repository";
import { LedgerRepository } from "../../finance/repositories/ledger.repository";
import { LedgerService } from "../../finance/services/ledger.service";
import { BranchService } from "../../organization/services/branch.service";
import { SettingsService } from "../../organization/services/settings.service";
import type { CashReconciliationDTO } from "../dto/sale.dto";
import { CashupRepository } from "../repositories/cashup.repository";
import { SaleReportRepository } from "../repositories/saleReport.repository";
import type { CloseCashupInput } from "../validators/sale.schema";

export class CashupService {
  static Instance = new CashupService();
  private constructor(
    private readonly repo = CashupRepository.Instance,
    private readonly reports = SaleReportRepository.Instance,
    private readonly accounts = AccountRepository.Instance,
    private readonly ledgerRepo = LedgerRepository.Instance,
    private readonly ledger = LedgerService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  /** Everything that happened at the till on one day. */
  async dailySummary(actor: Actor, query: { date?: string; branchId?: string }) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const date = query.date ?? todayIn(timezone);
    const branchId = readBranchScope(actor, query.branchId);
    const scope = { organizationId: actor.organizationId, branchId, from: date, to: date, timezone, soldById: ownSalesOnly(actor) };
    const [totals, returns, receipts, topItems, sellers, expenses] = await Promise.all([
      this.reports.totals(scope),
      this.reports.returnsTotals(scope),
      this.reports.receiptsByMethod(scope),
      this.reports.topItems(scope, 10),
      this.reports.bySeller(scope),
      can(actor, "expense.read") ? this.reports.expensesByMethod(scope) : Promise.resolve([]),
    ]);
    const showCost = can(actor, "product.viewcost");
    return {
      date,
      branchId,
      sales: {
        ...totals,
        costOfGoods: showCost ? totals.costOfGoods : undefined,
        grossProfit: showCost ? totals.netSales - totals.costOfGoods - (returns.value - returns.tax - returns.cost) : undefined,
      },
      returns,
      moneyReceived: receipts,
      totalReceived: receipts.reduce((s, r) => s + r.total, 0),
      expensesPaid: expenses,
      topItems: topItems.map((t) => ({ ...t, cost: showCost ? t.cost : undefined })),
      bySeller: sellers,
    };
  }

  async commissions(actor: Actor, query: { from?: string; to?: string; branchId?: string; soldById?: string }) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const { from, to } = resolveRange(timezone, query.from, query.to);
    const own = ownSalesOnly(actor);
    const rows = await this.reports.bySeller({
      organizationId: actor.organizationId,
      branchId: readBranchScope(actor, query.branchId),
      from,
      to,
      timezone,
      soldById: own ?? query.soldById ?? null,
    });
    return { from, to, sellers: rows, totalCommission: rows.reduce((s, r) => s + r.commission, 0) };
  }

  private async cashAccountFor(actor: Actor, branchId: string, accountId?: string): Promise<{ id: string; name: string }> {
    if (accountId) {
      const account = await this.accounts.findById(actor.organizationId, accountId);
      if (!account || account.type !== "cash") throw AppError.badRequest("Choose a cash account");
      return account;
    }
    const id = await this.accounts.findDefault(actor.organizationId, "cash", branchId);
    if (!id) throw AppError.badRequest("Set up a cash account first");
    const account = await this.accounts.findById(actor.organizationId, id);
    return account as { id: string; name: string };
  }

  /** What the cash drawer should hold at the end of the day. */
  async preview(actor: Actor, query: { date?: string; branchId?: string; accountId?: string }) {
    assertPermission(actor, "cashup.manage");
    const { timezone } = await this.settings.get(actor.organizationId);
    const date = query.date ?? todayIn(timezone);
    const branchId = await this.branches.resolveForWrite(actor, query.branchId);
    const account = await this.cashAccountFor(actor, branchId, query.accountId);
    const [expected, day, existing] = await Promise.all([
      this.ledgerRepo.balanceAt(account.id, date),
      this.ledgerRepo.dayTotals(account.id, date),
      this.repo.findForDay(account.id, date),
    ]);
    return { date, branchId, accountId: account.id, accountName: account.name, openingBalance: expected - day.totalIn + day.totalOut, cashIn: day.totalIn, cashOut: day.totalOut, expectedAmount: expected, alreadyClosed: existing };
  }

  async close(actor: Actor, data: CloseCashupInput): Promise<CashReconciliationDTO> {
    assertPermission(actor, "cashup.manage");
    const settings = await this.settings.get(actor.organizationId);
    const p = await this.preview(actor, data);
    if (p.alreadyClosed) throw AppError.conflict(`The cash for ${p.date} has already been closed`);
    const difference = data.countedAmount - p.expectedAmount;
    await inTransaction(async (tx) => {
      const id = await this.repo.create(
        {
          organizationId: actor.organizationId,
          branchId: p.branchId,
          accountId: p.accountId,
          reconDate: p.date,
          expectedAmount: p.expectedAmount,
          countedAmount: data.countedAmount,
          difference,
          notes: data.notes ?? null,
          adjustmentPosted: data.postAdjustment && difference !== 0,
          closedById: actor.id,
        },
        tx
      );
      if (data.postAdjustment && difference !== 0) {
        await this.ledger.post(
          actor,
          actor.organizationId,
          {
            accountId: p.accountId,
            branchId: p.branchId,
            date: p.date,
            direction: difference > 0 ? "in" : "out",
            amount: Math.abs(difference),
            type: "cash_adjustment",
            referenceType: "cash_reconciliation",
            referenceId: id,
            description: `Cash-up ${p.date}: ${difference > 0 ? "surplus" : "shortage"}`,
          },
          tx
        );
      }
      await this.audit.log(
        actor,
        {
          action: "create",
          entityType: "cash_reconciliation",
          entityId: id,
          summary: `Closed cash for ${p.date}: counted ${formatMoney(data.countedAmount, settings.currencySymbol)}, ${difference === 0 ? "balanced" : `${difference > 0 ? "over" : "short"} by ${formatMoney(Math.abs(difference), settings.currencySymbol)}`}`,
          after: { expected: p.expectedAmount, counted: data.countedAmount, difference, adjustmentPosted: data.postAdjustment && difference !== 0 },
        },
        tx
      );
    });
    return (await this.repo.findForDay(p.accountId, p.date)) as CashReconciliationDTO;
  }

  async list(actor: Actor, query: { page: number; limit: number; branchId?: string; from?: string; to?: string }) {
    assertPermission(actor, "cashup.manage");
    return this.repo.list(actor.organizationId, { ...query, branchId: readBranchScope(actor, query.branchId) });
  }
}
