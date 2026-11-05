import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useDashboardCharts, useDashboardSummary } from "@/hooks/useFinance"
import { formatMoney } from "@/lib/money"
import { formatDate } from "@/lib/utils"
import { ExpenseCategoryChart } from "@/components/dashboard/ExpenseCategoryChart"
import { ProfitTrendChart } from "@/components/dashboard/ProfitTrendChart"
import { PageLoader } from "@/components/shared/PageLoader"
import { StatCard } from "@/components/shared/StatCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  const { can, currencySymbol, selectedBranchId, user } = useAuth()
  const navigate = useNavigate()
  const canReadDashboard = can("dashboard.read")

  const { data: summary, isLoading } = useDashboardSummary(selectedBranchId || undefined, canReadDashboard)
  const { data: charts } = useDashboardCharts(
    { branchId: selectedBranchId || undefined, days: 14, months: 6 },
    canReadDashboard
  )

  if (!canReadDashboard) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center space-y-4">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Welcome, {user?.name}!
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Ready to serve customers? Jump straight into the Point of Sale or view your recent sales and customers.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {can("sale.create") && (
              <Button variant="emerald" onClick={() => navigate("/pos")} data-cy="welcome-pos-btn">
                <ShoppingCart className="h-4 w-4" />
                Open Point of Sale
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/sales")}>
              View Sales
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (isLoading || !summary) return <PageLoader message="Loading business intelligence..." />

  const maxDailySale = Math.max(...(charts?.salesTrend.map((d) => d.total) ?? [1]), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Business Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Live snapshot for {formatDate(summary.date)} · All figures in {currencySymbol}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("sale.create") && (
            <Button variant="emerald" size="sm" onClick={() => navigate("/pos")} data-cy="dash-new-sale">
              <ShoppingCart className="h-4 w-4" />
              New Sale (POS)
            </Button>
          )}
          {can("report.read") && (
            <Button variant="outline" size="sm" onClick={() => navigate("/reports")} data-cy="dash-reports">
              Reports & Export
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Sales"
          value={formatMoney(summary.today.sales, currencySymbol)}
          subtext={`${summary.today.salesCount} sale(s) today`}
          icon={<ShoppingCart className="h-5 w-5" />}
          tone="indigo"
        />
        <StatCard
          label="This Month's Revenue"
          value={formatMoney(summary.thisMonth.sales, currencySymbol)}
          subtext={`${summary.thisMonth.salesCount} sale(s) this month`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="emerald"
        />
        {summary.thisMonth.netProfit !== null ? (
          <StatCard
            label="Month Net Profit"
            value={formatMoney(summary.thisMonth.netProfit, currencySymbol)}
            subtext={`Gross: ${formatMoney(summary.thisMonth.grossProfit, currencySymbol)} · Exp: ${formatMoney(summary.thisMonth.expenses, currencySymbol)}`}
            icon={<Banknote className="h-5 w-5" />}
            tone={summary.thisMonth.netProfit >= 0 ? "emerald" : "rose"}
          />
        ) : (
          <StatCard
            label="Stock Alerts"
            value={`${summary.stock.outCount} Out · ${summary.stock.lowCount} Low`}
            subtext="Items needing restock"
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="amber"
          />
        )}
        {summary.cashPosition ? (
          <StatCard
            label="Cash & Bank Position"
            value={formatMoney(summary.cashPosition.total, currencySymbol)}
            subtext={`${summary.cashPosition.accounts.length} active account(s)`}
            icon={<Wallet className="h-5 w-5" />}
            tone="indigo"
          />
        ) : (
          <StatCard
            label="Customer Receivables"
            value={formatMoney(summary.customerDebts?.totalOutstanding ?? 0, currencySymbol)}
            subtext={`${summary.customerDebts?.debtorCount ?? 0} debtor(s)`}
            icon={<Users className="h-5 w-5" />}
            tone="amber"
          />
        )}
      </div>

      {/* Charts & Cash Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Last 14 Days Sales Trend</CardTitle>
              <p className="text-xs text-slate-500">Daily gross sales volume</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-1.5 sm:gap-2 pt-4">
              {(charts?.salesTrend ?? []).map((pt) => {
                const heightPct = Math.max(Math.round((pt.total / maxDailySale) * 100), 4)
                return (
                  <div key={pt.date} className="group relative flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 z-10 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-md">
                      {pt.date.slice(5)}: {formatMoney(pt.total, currencySymbol)} ({pt.count})
                    </div>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all group-hover:from-emerald-600 group-hover:to-emerald-400"
                    />
                    <span className="text-[10px] font-mono text-slate-400">{pt.date.slice(8)}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Payables & Receivables Quick Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Receivables & Payables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.customerDebts && (
              <div
                onClick={() => navigate("/customers")}
                className="rounded-xl border border-slate-200/80 p-3.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Owed by Customers</span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {summary.customerDebts.debtorCount} debtors
                  </span>
                </div>
                <p className="mt-1 font-mono-num text-lg font-extrabold text-slate-900 dark:text-white">
                  {formatMoney(summary.customerDebts.totalOutstanding, currencySymbol)}
                </p>
                {summary.customerDebts.overdueAmount > 0 && (
                  <p className="mt-0.5 text-xs font-medium text-rose-600">
                    {formatMoney(summary.customerDebts.overdueAmount, currencySymbol)} overdue ({summary.customerDebts.overdueCount})
                  </p>
                )}
              </div>
            )}

            {summary.payables && (
              <div
                onClick={() => navigate("/suppliers")}
                className="rounded-xl border border-slate-200/80 p-3.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Owed to Suppliers</span>
                  <span className="text-xs font-bold text-amber-600">Payables</span>
                </div>
                <p className="mt-1 font-mono-num text-lg font-extrabold text-slate-900 dark:text-white">
                  {formatMoney(summary.payables.totalOutstanding, currencySymbol)}
                </p>
                {summary.payables.overdueAmount > 0 && (
                  <p className="mt-0.5 text-xs font-medium text-rose-600">
                    {formatMoney(summary.payables.overdueAmount, currencySymbol)} overdue ({summary.payables.overdueCount})
                  </p>
                )}
              </div>
            )}

            {summary.cashPosition && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Accounts Breakdown</p>
                {summary.cashPosition.accounts.slice(0, 4).map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-600 dark:text-slate-300 truncate">{acc.name}</span>
                    <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">
                      {formatMoney(acc.balance, currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Profit over time & expenses by category (each shown only when the user may see it) */}
      {charts && (charts.profitByMonth.length > 0 || can("expense.read")) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {charts.profitByMonth.length > 0 && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Profit Over Time</CardTitle>
                <p className="text-xs text-slate-500">Net profit per month after cost of goods, expenses and payroll</p>
              </CardHeader>
              <CardContent>
                <ProfitTrendChart data={charts.profitByMonth} currencySymbol={currencySymbol} />
              </CardContent>
            </Card>
          )}
          {can("expense.read") && (
            <Card className={charts.profitByMonth.length > 0 ? "lg:col-span-2" : "lg:col-span-5"}>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
                <p className="text-xs text-slate-500">This month so far</p>
              </CardHeader>
              <CardContent>
                <ExpenseCategoryChart data={charts.expensesByCategory} currencySymbol={currencySymbol} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Bottom 3 Panels: Top Products, Stock Alerts, Upcoming Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-500" />
              Top Selling This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {summary.topProducts.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No sales recorded this month yet.</p>
            ) : (
              summary.topProducts.map((item) => (
                <div
                  key={item.variantId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                      {item.productName} {item.variantName && item.variantName !== "Default" ? `(${item.variantName})` : ""}
                    </p>
                    <p className="text-[11px] text-slate-500">{item.quantity} sold · {item.sku}</p>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-slate-900 dark:text-slate-100 shrink-0">
                    {formatMoney(item.revenue, currencySymbol)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Low / Out of Stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Stock Needing Attention ({summary.stock.outCount + summary.stock.lowCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {summary.stock.items.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">All items are well stocked!</p>
            ) : (
              summary.stock.items.slice(0, 5).map((st) => (
                <div
                  key={`${st.variantId}-${st.branchId}`}
                  onClick={() => navigate("/inventory")}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                      {st.productName} {st.variantName !== "Default" ? `(${st.variantName})` : ""}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      On hand: <strong>{st.quantity}</strong> (Reorder at {st.reorderLevel})
                    </p>
                  </div>
                  <StatusBadge status={st.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-rose-500" />
              Upcoming Bills & Supplies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {summary.upcomingPayments.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No supplier bills or recurring expenses due soon.</p>
            ) : (
              summary.upcomingPayments.slice(0, 5).map((up) => (
                <div
                  key={`${up.kind}-${up.id}`}
                  onClick={() => navigate(up.kind === "supplier" ? "/suppliers" : "/expenses")}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{up.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {up.reference} · Due {formatDate(up.dueDate)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono-num text-xs font-bold text-slate-900 dark:text-slate-100">
                      {formatMoney(up.amount, currencySymbol)}
                    </p>
                    {up.overdue && <span className="text-[10px] font-bold text-rose-600">OVERDUE</span>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
