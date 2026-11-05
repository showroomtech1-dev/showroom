import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePendingSales } from "@/hooks/usePendingSales"
import { formatMoney } from "@/lib/money"
import { formatDateTime } from "@/lib/utils"

/** Offline sales the server refused when they synced (e.g. an item sold out meanwhile). */
export function RefusedOfflineSales() {
  const { failed, retry, discard, syncNow } = usePendingSales()
  if (failed.length === 0) return null

  return (
    <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/30" role="alert">
      <p className="flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
        <AlertTriangle className="h-4 w-4" />
        {failed.length} sale{failed.length === 1 ? "" : "s"} made offline could not be recorded
      </p>
      {failed.map((sale) => (
        <div key={sale.clientRef} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 p-2.5 text-xs dark:bg-slate-900/60">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {formatMoney(sale.summary.total)} · {sale.summary.items} item{sale.summary.items === 1 ? "" : "s"}
              {sale.summary.customer ? ` · ${sale.summary.customer}` : ""}
            </p>
            <p className="text-slate-500">{formatDateTime(sale.createdAt)}</p>
            <p className="text-rose-700 dark:text-rose-300">{sale.error}</p>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                retry(sale.clientRef)
                void syncNow()
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
            <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => discard(sale.clientRef)}>
              <Trash2 className="h-3.5 w-3.5" /> Discard
            </Button>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
        Fix the problem (for example, receive the missing stock) and press Retry, or Discard and record the sale again.
      </p>
    </div>
  )
}
