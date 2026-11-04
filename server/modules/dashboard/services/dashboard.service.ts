// Home dashboard: today / this month at a glance, what needs attention, and chart series.
import { can } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import type { Actor } from "../../../shared/types/actor";
import { addDays, eachDate, startOfMonth, todayIn } from "../../../shared/utils/dates";
import { CustomerService } from "../../customer/services/customer.service";
import { ExpenseRepository } from "../../expense/repositories/expense.repository";
import { RecurringExpenseRepository } from "../../expense/repositories/recurringExpense.repository";
import { AccountService } from "../../finance/services/account.service";
import { FinanceReportService } from "../../finance/services/financeReport.service";
import { StockService } from "../../inventory/services/stock.service";
import { SettingsService } from "../../organization/services/settings.service";
import { SaleReportRepository } from "../../sale/repositories/saleReport.repository";
import { SupplierRepository } from "../../supplier/repositories/supplier.repository";
import { SupplierService } from "../../supplier/services/supplier.service";

export class DashboardService {
  static Instance = new DashboardService();
  private constructor(
    private readonly sales = SaleReportRepository.Instance,
    private readonly finance = FinanceReportService.Instance,
    private readonly stock = StockService.Instance,
    private readonly suppliers = SupplierService.Instance,
    private readonly supplierRepo = SupplierRepository.Instance,
    private readonly customers = CustomerService.Instance,
    private readonly expenses = ExpenseRepository.Instance,
    private readonly recurring = RecurringExpenseRepository.Instance,
    private readonly accounts = AccountService.Instance,
    private readonly settings = SettingsService.Instance
  ) {}

  async summary(actor: Actor, branchId?: string) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const today = todayIn(timezone);
    const monthStart = startOfMonth(today);
    const branch = readBranchScope(actor, branchId);
    const scope = (from: string, to: string) => ({ organizationId: actor.organizationId, branchId: branch, from, to, timezone, soldById: null });
    const showProfit = can(actor, "finance.read") || can(actor, "product.viewcost");
    const upcomingUntil = addDays(today, 14);

    const [todaySales, monthSales, pnl, stockCounts, attention, topProducts, payables, receivables, dueSupplies, dueBills, accounts] = await Promise.all([
      this.sales.totals(scope(today, today)),
      this.sales.totals(scope(monthStart, today)),
      showProfit ? this.finance.profitAndLoss(actor, { from: monthStart, to: today, branchId: branch ?? undefined }) : Promise.resolve(null),
      this.stock.alertCounts(actor, branch ?? undefined),
      this.stock.levels(actor, { page: 1, limit: 10, status: "attention", branchId: branch ?? undefined }),
      this.sales.topItems(scope(monthStart, today), 5),
      can(actor, "supplier.read") || can(actor, "finance.read") ? this.suppliers.payables(actor) : Promise.resolve(null),
      can(actor, "customer.read") || can(actor, "finance.read") ? this.customers.receivables(actor) : Promise.resolve(null),
      can(actor, "supplier.read") ? this.supplierRepo.dueSupplies(actor.organizationId, today, upcomingUntil, 10) : Promise.resolve([]),
      can(actor, "expense.read") ? this.recurring.due(actor.organizationId, today, upcomingUntil) : Promise.resolve([]),
      can(actor, "account.read") ? this.accounts.list(actor, { branchId: branch ?? undefined }) : Promise.resolve(null),
    ]);

    const upcomingPayments = [
      ...dueSupplies.map((s) => ({ kind: "supplier", id: s.supplyId, title: s.supplierName, reference: s.code, dueDate: s.dueDate, amount: Number(s.outstanding), overdue: s.dueDate < today })),
      ...dueBills.map((b) => ({ kind: "recurring_expense", id: b.id, title: b.name, reference: b.categoryName, dueDate: b.nextDueDate, amount: Number(b.amount), overdue: b.nextDueDate < today })),
    ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return {
      date: today,
      branchId: branch,
      today: { sales: todaySales.totalSales, salesCount: todaySales.salesCount, netSales: todaySales.netSales },
      thisMonth: {
        sales: monthSales.totalSales,
        salesCount: monthSales.salesCount,
        netSales: monthSales.netSales,
        grossProfit: pnl?.grossProfit ?? null,
        expenses: pnl?.expenses.total ?? null,
        netProfit: pnl?.netProfit ?? null,
      },
      stock: { lowCount: stockCounts.low, outCount: stockCounts.out, items: attention.data },
      payables: payables ? { totalOutstanding: payables.totalOutstanding, overdueAmount: payables.overdueAmount, overdueCount: payables.overdueCount, topSuppliers: payables.topSuppliers } : null,
      customerDebts: receivables,
      upcomingPayments,
      topProducts: topProducts.map((t) => ({ ...t, cost: showProfit ? t.cost : undefined })),
      cashPosition: accounts
        ? { total: accounts.reduce((s, a) => s + Number(a.balance), 0), accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, balance: Number(a.balance) })) }
        : null,
    };
  }

  async charts(actor: Actor, query: { days: number; months: number; branchId?: string }) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const today = todayIn(timezone);
    const from = addDays(today, -(query.days - 1));
    const branch = readBranchScope(actor, query.branchId);
    const showProfit = can(actor, "finance.read") || can(actor, "product.viewcost");
    const [daily, byCategory, profit] = await Promise.all([
      this.sales.dailySeries({ organizationId: actor.organizationId, branchId: branch, from, to: today, timezone }),
      can(actor, "expense.read")
        ? this.expenses.grouped(actor.organizationId, "category", { branchId: branch, from: startOfMonth(today), to: today })
        : Promise.resolve([]),
      showProfit ? this.finance.profitTrend(actor, query.months, branch ?? undefined) : Promise.resolve([]),
    ]);
    // Fill gaps so the chart has a point for every day.
    const byDate = new Map(daily.map((d) => [d.date, d]));
    const salesTrend = eachDate(from, today).map((date) => {
      const d = byDate.get(date);
      return { date, total: d?.total ?? 0, count: d?.count ?? 0, ...(showProfit ? { grossProfit: (d?.net ?? 0) - (d?.cost ?? 0) } : {}) };
    });
    return {
      salesTrend,
      expensesByCategory: byCategory.map((c) => ({ category: c.label, total: c.total })),
      profitByMonth: profit,
    };
  }
}
