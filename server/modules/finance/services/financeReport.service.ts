// Profit & loss, cash flow, and payables / receivables summaries.
import { readBranchScope } from "../../../shared/access/scope";
import type { Actor } from "../../../shared/types/actor";
import { addDays, addMonths, resolveRange, startOfMonth, todayIn } from "../../../shared/utils/dates";
import { CustomerService } from "../../customer/services/customer.service";
import { SettingsService } from "../../organization/services/settings.service";
import { SupplierService } from "../../supplier/services/supplier.service";
import { FinanceReportRepository } from "../repositories/financeReport.repository";

const CASH_LABELS: Record<string, string> = {
  sale_payment: "Sales (paid at till)",
  customer_payment: "Customer debt payments",
  sale_refund: "Refunds to customers",
  supplier_payment: "Payments to suppliers & vendors",
  expense: "Expenses",
  payroll_payment: "Salaries",
  loan_disbursement: "Staff loans & advances issued",
  loan_repayment: "Staff loan repayments",
  cash_adjustment: "Cash count adjustments",
  reversal: "Reversals (deleted / voided records)",
};

export class FinanceReportService {
  static Instance = new FinanceReportService();
  private constructor(
    private readonly repo = FinanceReportRepository.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly suppliers = SupplierService.Instance,
    private readonly customers = CustomerService.Instance
  ) {}

  async profitAndLoss(actor: Actor, query: { from?: string; to?: string; branchId?: string }) {
    const { timezone, taxName } = await this.settings.get(actor.organizationId);
    const { from, to } = resolveRange(timezone, query.from, query.to);
    const scope = { organizationId: actor.organizationId, branchId: readBranchScope(actor, query.branchId), from, to, timezone };
    const [sales, expenseRows, vendorBills, payroll] = await Promise.all([
      this.repo.salesFigures(scope),
      this.repo.expensesByCategory(scope),
      this.repo.vendorBills(scope),
      this.repo.payroll(scope),
    ]);
    const netSales = sales.grossSales - sales.salesTax;
    const returns = sales.returnsValue - sales.returnsTax;
    const revenue = netSales - returns;
    const costOfGoodsSold = sales.cost - sales.returnsCost;
    const grossProfit = revenue - costOfGoodsSold;
    const expenses = expenseRows.reduce((s, e) => s + e.amount, 0);
    const operatingExpenses = expenses + vendorBills + payroll;
    const netProfit = grossProfit - operatingExpenses;
    return {
      from,
      to,
      branchId: scope.branchId,
      revenue: { salesExcludingTax: netSales, returns, discountsGiven: sales.discounts, total: revenue, salesCount: sales.count },
      costOfGoodsSold,
      grossProfit,
      grossMarginBps: revenue > 0 ? Math.round((grossProfit * 10_000) / revenue) : 0,
      expenses: {
        byCategory: expenseRows,
        vendorBills,
        payroll,
        total: operatingExpenses,
      },
      netProfit,
      netMarginBps: revenue > 0 ? Math.round((netProfit * 10_000) / revenue) : 0,
      tax: { name: taxName, collected: sales.salesTax - sales.returnsTax },
    };
  }

  async cashFlow(actor: Actor, query: { from?: string; to?: string; branchId?: string }) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const { from, to } = resolveRange(timezone, query.from, query.to);
    const branchId = readBranchScope(actor, query.branchId);
    const [movements, opening, closing] = await Promise.all([
      this.repo.cashMovements({ organizationId: actor.organizationId, branchId, from, to }),
      branchId ? Promise.resolve(null) : this.repo.totalBalanceAt(actor.organizationId, addDays(from, -1)),
      branchId ? Promise.resolve(null) : this.repo.totalBalanceAt(actor.organizationId, to),
    ]);
    const lines = movements.map((m) => ({ ...m, label: CASH_LABELS[m.type] ?? m.type }));
    const inflows = lines.filter((l) => l.direction === "in");
    const outflows = lines.filter((l) => l.direction === "out");
    const totalIn = inflows.reduce((s, l) => s + l.amount, 0);
    const totalOut = outflows.reduce((s, l) => s + l.amount, 0);
    return { from, to, branchId, openingBalance: opening, inflows, outflows, totalIn, totalOut, netCashFlow: totalIn - totalOut, closingBalance: closing };
  }

  async profitTrend(actor: Actor, months = 12, branchId?: string) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const today = todayIn(timezone);
    const from = startOfMonth(addMonths(today, -(months - 1)));
    return this.repo.monthlyProfit(actor.organizationId, readBranchScope(actor, branchId), from, today, timezone);
  }

  /** Accounts payable (owed to suppliers) and receivable (owed by customers). */
  async payablesReceivables(actor: Actor) {
    const [payables, receivables, debtors] = await Promise.all([
      this.suppliers.payables(actor),
      this.customers.receivables(actor),
      this.customers.debtors(actor, "json"),
    ]);
    const aging = Array.isArray(debtors)
      ? debtors.reduce(
          (a, d) => ({
            current: a.current + Number(d.current),
            days1to30: a.days1to30 + Number(d.days1to30),
            days31to60: a.days31to60 + Number(d.days31to60),
            days61to90: a.days61to90 + Number(d.days61to90),
            over90: a.over90 + Number(d.over90),
          }),
          { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 }
        )
      : null;
    return {
      payables: { totalOutstanding: payables.totalOutstanding, overdueAmount: payables.overdueAmount, overdueCount: payables.overdueCount, dueSoonAmount: payables.dueSoonAmount, supplierCredit: -payables.creditBalances, topSuppliers: payables.topSuppliers },
      receivables: { ...receivables, aging, topDebtors: Array.isArray(debtors) ? debtors.slice(0, 10) : [] },
    };
  }
}
