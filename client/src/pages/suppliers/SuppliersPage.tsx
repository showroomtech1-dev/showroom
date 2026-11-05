import { useState } from "react"
import { CreditCard, Edit2, Eye, PackagePlus, Plus, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useDeleteSupplier,
  useDeleteSupplierPayment,
  useDeleteSupply,
  usePayablesSummary,
  useSupplierPayments,
  useSuppliers,
  useSupplies,
  useUploadPaymentProof,
} from "@/hooks/useSuppliers"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { formatMoney } from "@/lib/money"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TableStatus } from "@/components/shared/TableStatus"
import { Select } from "@/components/ui/select"
import { SearchInput } from "@/components/shared/SearchInput"
import { StatCard } from "@/components/shared/StatCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { RecordSupplyModal, SupplierEditorModal } from "@/components/suppliers/SupplyModal"
import { SupplierPaymentModal, SupplierStatementModal } from "@/components/suppliers/SupplierPaymentModal"
import type { Supplier } from "@/types/supplier.types"

export default function SuppliersPage() {
  const { can, activeBranchId } = useAuth()
  const [tab, setTab] = useState<"suppliers" | "supplies" | "payments">("suppliers")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [page, setPage] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [supplyOpen, setSupplyOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [payTarget, setPayTarget] = useState<Supplier | null>(null)
  const [stmtTarget, setStmtTarget] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)

  const debouncedSearch = useDebouncedSearch(search, 300, () => setPage(1))

  const suppliersQuery = useSuppliers({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    type: typeFilter || undefined,
  })
  const payablesQuery = usePayablesSummary()
  const suppliesQuery = useSupplies({ page, limit: 20, branchId: activeBranchId || undefined })
  const paymentsQuery = useSupplierPayments({ page, limit: 20, branchId: activeBranchId || undefined })
  const deleteSupplier = useDeleteSupplier()
  const deleteSupply = useDeleteSupply()
  const deletePayment = useDeleteSupplierPayment()
  const uploadProof = useUploadPaymentProof()

  const summary = payablesQuery.data

  return (
    <div className="space-y-4" data-cy="suppliers-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Suppliers, Vendors & Payables
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage stock suppliers, service vendors, Goods Received Notes (GRN), and vendor payments
          </p>
        </div>
        <div className="flex gap-2">
          {can("supply.create") && (
            <Button variant="outline" size="sm" onClick={() => setSupplyOpen(true)}>
              <PackagePlus className="h-4 w-4" />
              Receive Stock (GRN)
            </Button>
          )}
          {can("supplier.manage") && (
            <Button size="sm" onClick={() => { setEditTarget(null); setEditorOpen(true) }} data-cy="add-supplier-btn">
              <Plus className="h-4 w-4" /> New Partner
            </Button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total Payables" value={formatMoney(summary.totalOutstanding)} tone="amber" />
          <StatCard label="Overdue Bills" value={formatMoney(summary.overdueAmount)} subtitle={`${summary.overdueCount} bills`} tone="rose" />
          <StatCard label="Due Within 7 Days" value={formatMoney(summary.dueSoonAmount)} subtitle={`${summary.dueSoonCount} bills`} />
          <StatCard label="Supplier Prepayments" value={formatMoney(summary.creditBalances)} tone="emerald" />
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {([["suppliers", "Suppliers & Vendors"], ["supplies", "Goods Received (GRN)"], ["payments", "Supplier Payments (SPY)"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setTab(k); setPage(1) }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
              tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "suppliers" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search company, contact, phone..." />
            <Select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
              options={[{ value: "supplier", label: "Stock Suppliers" }, { value: "vendor", label: "Service Vendors" }]}
              placeholder="All Partner Types"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Supplied</th>
                  <th className="px-4 py-3 text-right">Balance Payable</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <TableStatus loading={suppliersQuery.isLoading} error={suppliersQuery.isError} empty={(suppliersQuery.data?.data ?? []).length === 0} cols={7} />
                {(suppliersQuery.data?.data ?? []).map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-slate-500">{s.code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{s.name}</td>
                    <td className="px-4 py-3 uppercase text-slate-500">{s.type}</td>
                    <td className="px-4 py-3 text-slate-500">{s.phone || "—"}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(s.totalSupplied)}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        s.balance > 0 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {formatMoney(s.balance)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setStmtTarget(s)} title="Statement">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {can("supplier.payment") && (
                          <Button variant="ghost" size="icon" onClick={() => setPayTarget(s)} title="Record Payment">
                            <CreditCard className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {can("supplier.manage") && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditTarget(s)
                                setEditorOpen(true)
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(s)}
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
          <Pagination meta={suppliersQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      {tab === "supplies" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">GRN Code</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <TableStatus loading={suppliesQuery.isLoading} error={suppliesQuery.isError} empty={(suppliesQuery.data?.data ?? []).length === 0} cols={8} />
              {(suppliesQuery.data?.data ?? []).map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3 font-mono font-semibold">{g.code}</td>
                  <td className="px-4 py-3 font-medium">{g.supplierName}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(g.supplyDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(g.totalCost)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatMoney(g.amountPaid)}</td>
                  <td className="px-4 py-3 text-right text-rose-600">{formatMoney(g.outstanding)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={g.paymentStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {can("supply.delete") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteSupply.mutate(g.id)}
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

      {tab === "payments" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <TableStatus loading={paymentsQuery.isLoading} error={paymentsQuery.isError} empty={(paymentsQuery.data?.data ?? []).length === 0} cols={6} />
              {(paymentsQuery.data?.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono font-semibold">{p.code}</td>
                  <td className="px-4 py-3 font-medium">{p.supplierName}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-3 uppercase text-slate-500">{p.method}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(p.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <label className="inline-flex cursor-pointer items-center rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Upload className="h-3.5 w-3.5" />
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) uploadProof.mutate({ id: p.id, file: f })
                          }}
                        />
                      </label>
                      {can("supplier.payment") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePayment.mutate(p.id)}
                          className="text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SupplierEditorModal open={editorOpen} supplier={editTarget} onClose={() => setEditorOpen(false)} />
      <RecordSupplyModal open={supplyOpen} onClose={() => setSupplyOpen(false)} />
      <SupplierPaymentModal supplier={payTarget} onClose={() => setPayTarget(null)} />
      <SupplierStatementModal supplier={stmtTarget} onClose={() => setStmtTarget(null)} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteSupplier.mutateAsync(deleteTarget.id)
            toast.success("Partner moved to trash")
            setDeleteTarget(null)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not delete partner")
          }
        }}
        title="Delete Supplier / Vendor"
        description={`Move ${deleteTarget?.name} to trash?`}
        confirmLabel="Delete"
        loading={deleteSupplier.isPending}
      />
    </div>
  )
}
