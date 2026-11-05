import { useState } from "react"
import { CreditCard, Download, Edit2, Eye, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useCustomerPayments,
  useCustomers,
  useDebtors,
  useDeleteCustomer,
  useDeleteCustomerPayment,
  useReceivablesSummary,
} from "@/hooks/useCustomers"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { CustomerEndpoints } from "@/endpoints/customer.endpoints"
import { formatMoney } from "@/lib/money"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { SearchInput } from "@/components/shared/SearchInput"
import { StatCard } from "@/components/shared/StatCard"
import { Pagination } from "@/components/shared/Pagination"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  CustomerEditorModal,
  CustomerPaymentModal,
  CustomerStatementModal,
} from "@/components/customers/CustomerModal"
import type { Customer } from "@/types/customer.types"

export default function CustomersPage() {
  const { can } = useAuth()
  const [tab, setTab] = useState<"directory" | "debtors" | "payments">("directory")
  const [search, setSearch] = useState("")
  const [withDebt, setWithDebt] = useState("")
  const [sort, setSort] = useState("name")
  const [page, setPage] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [payTarget, setPayTarget] = useState<Customer | null>(null)
  const [stmtTarget, setStmtTarget] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  const debouncedSearch = useDebouncedSearch(search, 300, () => setPage(1))

  const customersQuery = useCustomers({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    withDebt: withDebt || undefined,
    sort,
  })
  const receivablesQuery = useReceivablesSummary()
  const debtorsQuery = useDebtors()
  const paymentsQuery = useCustomerPayments({ page, limit: 20 })
  const deleteCustomer = useDeleteCustomer()
  const deletePayment = useDeleteCustomerPayment()

  const summary = receivablesQuery.data

  return (
    <div className="space-y-4" data-cy="customers-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Customers & Receivables
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Customer directory, credit accounts, ageing debtors, and debt payments
          </p>
        </div>
        {can("customer.manage") && (
          <Button
            size="sm"
            onClick={() => {
              setEditTarget(null)
              setEditorOpen(true)
            }}
            data-cy="add-customer-btn"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total Receivables" value={formatMoney(summary.totalOutstanding)} subtitle={`${summary.debtorCount} debtors`} tone="amber" />
          <StatCard label="Overdue Debt" value={formatMoney(summary.overdueAmount)} subtitle={`${summary.overdueCount} accounts`} tone="rose" />
          <StatCard label="Customer Credit Held" value={formatMoney(summary.creditHeld)} tone="emerald" />
          <StatCard label="Active Debtors" value={String(summary.debtorCount)} />
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            ["directory", "Customers Directory"],
            ["debtors", "Debtors Ageing"],
            ["payments", "Debt Payments (CPY)"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setTab(k)
              setPage(1)
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              tab === k
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "directory" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, code..." />
            <Select
              value={withDebt}
              onChange={(e) => {
                setWithDebt(e.target.value)
                setPage(1)
              }}
              options={[
                { value: "true", label: "Owing Balance Only" },
                { value: "false", label: "Zero Balance Only" },
              ]}
              placeholder="All Customers"
            />
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              options={[
                { value: "name", label: "Sort by Name" },
                { value: "debt", label: "Highest Balance Owing" },
                { value: "purchases", label: "Highest Lifetime Spend" },
                { value: "newest", label: "Newest Added" },
              ]}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Total Spend</th>
                  <th className="px-4 py-3 text-right">Balance Owing</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(customersQuery.data?.data ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-slate-500">{c.code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(c.totalPurchases)}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        c.balance > 0 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {formatMoney(c.balance)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setStmtTarget(c)} title="Statement">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {can("customer.payment") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPayTarget(c)}
                            title="Record Debt Payment"
                          >
                            <CreditCard className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {can("customer.manage") && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditTarget(c)
                                setEditorOpen(true)
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(c)}
                              className="text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={customersQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      {tab === "debtors" && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => CustomerEndpoints.downloadDebtors("pdf")}>
              <Download className="h-3.5 w-3.5" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => CustomerEndpoints.downloadDebtors("xlsx")}>
              <Download className="h-3.5 w-3.5" />
              Export Excel
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Current</th>
                  <th className="px-4 py-3 text-right">1–30 Days</th>
                  <th className="px-4 py-3 text-right">31–60 Days</th>
                  <th className="px-4 py-3 text-right">61–90 Days</th>
                  <th className="px-4 py-3 text-right">90+ Days</th>
                  <th className="px-4 py-3 text-right">Total Owing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(debtorsQuery.data ?? []).map((d) => (
                  <tr key={d.customerId}>
                    <td className="px-4 py-3 font-semibold">{d.name}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(d.current)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(d.days1to30)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatMoney(d.days31to60)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatMoney(d.days61to90)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{formatMoney(d.over90)}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">{formatMoney(d.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Method / Account</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(paymentsQuery.data?.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono font-semibold">{p.code}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-3 font-medium">{p.customerName}</td>
                  <td className="px-4 py-3 uppercase text-slate-500">
                    {p.method} • {p.accountName}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(p.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    {can("customer.payment") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          try {
                            await deletePayment.mutateAsync(p.id)
                            toast.success("Payment reversed")
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Could not reverse payment")
                          }
                        }}
                        className="text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerEditorModal open={editorOpen} customer={editTarget} onClose={() => setEditorOpen(false)} />
      <CustomerPaymentModal customer={payTarget} onClose={() => setPayTarget(null)} />
      <CustomerStatementModal customer={stmtTarget} onClose={() => setStmtTarget(null)} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteCustomer.mutateAsync(deleteTarget.id)
            toast.success("Customer moved to trash")
            setDeleteTarget(null)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not delete customer")
          }
        }}
        title="Delete Customer"
        description={`Move ${deleteTarget?.name} to trash?`}
        confirmLabel="Delete"
        loading={deleteCustomer.isPending}
      />
    </div>
  )
}
