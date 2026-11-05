import { CloudOff, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { usePendingSales } from "@/hooks/usePendingSales"
import { formatMoney } from "@/lib/money"

/**
 * Shows when the device is offline or has sales waiting to sync, and keeps syncing them in the
 * background (mounted once, in the layout).
 */
export function OfflineSalesBanner() {
  const { can } = useAuth()
  const { online, pendingCount, failed, syncing, syncNow, items } = usePendingSales(can("sale.create"))
  if (online && pendingCount === 0 && failed.length === 0) return null

  const waitingTotal = items.filter((s) => s.status === "pending").reduce((s, i) => s + i.summary.total, 0)

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs sm:px-6 lg:px-8 ${
        online ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : "bg-slate-800 text-white"
      }`}
    >
      <CloudOff className="h-4 w-4 shrink-0" />
      <span className="font-medium">
        {online ? "Back online." : "You're offline."}{" "}
        {pendingCount > 0
          ? `${pendingCount} sale${pendingCount === 1 ? "" : "s"} (${formatMoney(waitingTotal)}) saved on this device ${online ? "— syncing now." : "will sync when the connection returns."}`
          : online
            ? ""
            : "New sales will be saved on this device and synced later."}
        {failed.length > 0 && ` ${failed.length} offline sale${failed.length === 1 ? " was" : "s were"} refused — review them on the POS screen.`}
      </span>
      {online && pendingCount > 0 && (
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-current/30 px-2 py-0.5 font-semibold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      )}
    </div>
  )
}
