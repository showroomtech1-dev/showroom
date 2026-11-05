import { useState } from "react"
import { Link } from "react-router-dom"
import { Eye, Plus, Printer } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useDailySummary, useSaleReturns, useSales } from "@/hooks/useSales"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { SaleEndpoints } from "@/endpoints/sale.endpoints"
import { formatMoney } from "@/lib/money"
import { formatDate, formatDateTime, todayIso } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TableStatus } from "@/components/shared/TableStatus"
import { DatePickerField } from "@/components/ui/date-picker"
import { Select } from "@/components/ui/select"
import { SearchInput } from "@/components/shared/SearchInput"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import { StatCard } from "@/components/shared/StatCard"
import { SaleDetailModal } from "@/components/sales/SaleDetailModal"
import { CashupPanel, CommissionsPanel } from "@/components/sales/CashupPanel"

type TabKey = "sales" | "returns" | "daily" | "cashup" | "commissions"

export default function SalesPage() {
  const { can, activeBranchId } = useAuth()
  const [tab, setTab] = useState<TabKey>("sales")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const [paymentStatus, setPaymentStatus] = useState("")
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [dailyDate, setDailyDate] = useState(todayIso())

  const debouncedSearch = useDebouncedSearch(search, 300, () => setPage(1))

  const salesQuery = useSales({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    paymentStatus: paymentStatus || undefined,
    branchId: activeBranchId || undefined,
  })
  const returnsQuery = useSaleReturns({
    page,
    limit: 20,
    branchId: activeBranchId || undefined,
  })
  const dailyQuery = useDailySummary({
    date: dailyDate,
    branchId: activeBranchId || undefined,
  })

  return (
    <div className="space-y-4" data-cy="sales-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sales & Register</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track invoices, returns, daily summaries, and register cash-ups
          </p>
        </div>
        {can("sale.create") && (
          <Link to="/pos">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New POS Sale
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            ["sales", "Sales History"],
            ["returns", "Returns & Refunds"],
            ["daily", "Daily Summary"],
            ["cashup", "Cash-Up Register"],
            ["commissions", "Commissions"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key)
              setPage(1)
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
              tab === key
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "sales" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search receipt code, customer..."
            />
            <Select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value)
                setPage(1)
              }}
              options={[
                { value: "paid", label: "Paid in Full" },
                { value: "part_paid", label: "Part Paid" },
                { value: "credit", label: "On Credit" },
              ]}
              placeholder="All Payment Statuses"
            />
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              options={[
                { value: "completed", label: "Completed" },
                { value: "voided", label: "Voided" },
              ]}
              placeholder="All Sale Statuses"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <TableStatus loading={salesQuery.isLoading} error={salesQuery.isError} empty={(salesQuery.data?.data ?? []).length === 0} cols={8} />
                {(salesQuery.data?.data ?? []).map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    data-cy={`sale-row-${sale.code}`}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {sale.code}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(sale.soldAt)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {sale.customerName || "Walk-in"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(sale.total)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatMoney(sale.amountPaid)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{formatMoney(sale.balanceDue)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={sale.paymentStatus} />
                        {sale.status === "voided" && <StatusBadge status="voided" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedSaleId(sale.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => SaleEndpoints.openReceiptPdf(sale.id, "thermal")}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={salesQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      {tab === "returns" && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Return Code</th>
                  <th className="px-4 py-3">Sale</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Return Value</th>
                  <th className="px-4 py-3 text-right">Cash Refund</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <TableStatus loading={returnsQuery.isLoading} error={returnsQuery.isError} empty={(returnsQuery.data?.data ?? []).length === 0} cols={7} />
                {(returnsQuery.data?.data ?? []).map((ret) => (
                  <tr key={ret.id}>
                    <td className="px-4 py-3 font-mono font-semibold">{ret.code}</td>
                    <td className="px-4 py-3 font-mono text-blue-600">{ret.saleCode}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(ret.returnDate)}</td>
                    <td className="px-4 py-3">{ret.customerName || "Walk-in"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(ret.totalValue)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{formatMoney(ret.refundAmount)}</td>
                    <td className="px-4 py-3 text-slate-500">{ret.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={returnsQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      {tab === "daily" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Summary Date</span>
            <div className="w-40">
              <DatePickerField value={dailyDate} onChange={setDailyDate} data-cy="daily-summary-date" />
            </div>
          </div>
          {dailyQuery.data && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Gross Sales" value={formatMoney(dailyQuery.data.sales.totalSales)} subtitle={`${dailyQuery.data.sales.salesCount} sales`} />
              <StatCard label="Net Sales" value={formatMoney(dailyQuery.data.sales.netSales)} />
              <StatCard label="Money Received" value={formatMoney(dailyQuery.data.totalReceived)} tone="emerald" />
              <StatCard label="New Credit Due" value={formatMoney(dailyQuery.data.sales.balanceDue)} tone="amber" />
            </div>
          )}
        </div>
      )}

      {tab === "cashup" && <CashupPanel />}
      {tab === "commissions" && <CommissionsPanel />}

      <SaleDetailModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
    </div>
  )
}
