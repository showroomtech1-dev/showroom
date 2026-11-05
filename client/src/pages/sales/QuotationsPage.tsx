import { useState } from "react"
import { ArrowRightCircle, FileText, Plus, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useDeleteQuotation, useQuotations, useSetQuotationStatus } from "@/hooks/useSales"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { SaleEndpoints } from "@/endpoints/sale.endpoints"
import { formatMoney } from "@/lib/money"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { SearchInput } from "@/components/shared/SearchInput"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { ConvertQuotationDialog, QuotationModal } from "@/components/sales/QuotationModal"
import type { Quotation } from "@/types/sale.types"

export default function QuotationsPage() {
  const { can, activeBranchId } = useAuth()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [convertTarget, setConvertTarget] = useState<Quotation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null)

  const debouncedSearch = useDebouncedSearch(search, 300, () => setPage(1))

  const quotesQuery = useQuotations({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    branchId: activeBranchId || undefined,
  })
  const setQuoteStatus = useSetQuotationStatus()
  const deleteQuote = useDeleteQuotation()

  const handleStatusChange = async (id: string, nextStatus: "sent" | "accepted" | "cancelled") => {
    try {
      await setQuoteStatus.mutateAsync({ id, status: nextStatus })
      toast.success(`Quotation marked as ${nextStatus}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    }
  }

  return (
    <div className="space-y-4" data-cy="quotations-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Quotations & Proforma Invoices
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Prepare client estimates, download Proforma PDFs, and convert approved quotes to sales
          </p>
        </div>
        {can("quotation.manage") && (
          <Button size="sm" onClick={() => setCreateOpen(true)} data-cy="new-quotation-btn">
            <Plus className="h-4 w-4" />
            New Quotation
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search quote code or customer..." />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          options={[
            { value: "draft", label: "Draft" },
            { value: "sent", label: "Sent" },
            { value: "accepted", label: "Accepted" },
            { value: "converted", label: "Converted to Sale" },
            { value: "expired", label: "Expired" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          placeholder="All Statuses"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Valid Until</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {(quotesQuery.data?.data ?? []).map((q) => (
              <tr key={q.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {q.code}
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(q.quoteDate)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(q.validUntil)}</td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                  {q.customerName || "Walk-in"}
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatMoney(q.total)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={q.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => SaleEndpoints.openQuotationPdf(q.id, "quotation")}
                      title="Quotation PDF"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Quote
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => SaleEndpoints.openQuotationPdf(q.id, "proforma")}
                      title="Proforma Invoice PDF"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                      Proforma
                    </Button>
                    {q.status === "draft" && can("quotation.manage") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(q.id, "sent")}
                        title="Mark as Sent"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {["draft", "sent", "accepted"].includes(q.status) && can("sale.create") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConvertTarget(q)}
                      >
                        <ArrowRightCircle className="h-3.5 w-3.5 text-emerald-600" />
                        Convert
                      </Button>
                    )}
                    {["draft", "cancelled", "expired"].includes(q.status) && can("quotation.manage") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(q)}
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

      <Pagination meta={quotesQuery.data?.meta} onPageChange={setPage} />

      <QuotationModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ConvertQuotationDialog quotation={convertTarget} onClose={() => setConvertTarget(null)} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteQuote.mutateAsync(deleteTarget.id)
            toast.success("Quotation deleted")
            setDeleteTarget(null)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not delete quotation")
          }
        }}
        title="Delete Quotation"
        description={`Move quotation ${deleteTarget?.code} to trash?`}
        confirmLabel="Delete"
        loading={deleteQuote.isPending}
      />
    </div>
  )
}
