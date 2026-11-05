import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { queryClient } from "@/lib/queryClient"
import { offlineSales, syncPendingSales, type PendingSale } from "@/lib/offlineSales"
import { SALES_KEY } from "./useSales"
import { INVENTORY_KEY } from "./useInventory"
import { PRODUCTS_KEY } from "./useProducts"

const RETRY_MS = 60_000

/** Online / offline state of the browser. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener("online", up)
    window.addEventListener("offline", down)
    return () => {
      window.removeEventListener("online", up)
      window.removeEventListener("offline", down)
    }
  }, [])
  return online
}

/**
 * The sales waiting on this device. `autoSync` (use it once, in the app layout) sends them when the
 * connection returns, on load, and every minute while any are waiting.
 */
export function usePendingSales(autoSync = false) {
  const { user } = useAuth()
  const userId = user?.id ?? ""
  const mine = useCallback(() => offlineSales.list().filter((s) => s.userId === userId), [userId])
  const [items, setItems] = useState<PendingSale[]>(mine)
  const online = useOnlineStatus()
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setItems(mine())
    return offlineSales.subscribe(() => setItems(mine()))
  }, [mine])

  const syncNow = useCallback(async (announce = true) => {
    if (!userId || mine().every((s) => s.status !== "pending")) return
    setSyncing(true)
    try {
      const { synced, failed } = await syncPendingSales(userId)
      if (synced > 0) {
        queryClient.invalidateQueries({ queryKey: [SALES_KEY] })
        queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
        queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] })
      }
      if (announce && synced > 0) toast.success(`${synced} offline sale${synced === 1 ? "" : "s"} synced`)
      if (failed > 0) toast.error(`${failed} offline sale${failed === 1 ? " was" : "s were"} refused — open the POS to review`)
    } finally {
      setSyncing(false)
    }
  }, [userId, mine])

  useEffect(() => {
    if (!autoSync || !online) return
    void syncNow()
    const timer = window.setInterval(() => void syncNow(), RETRY_MS)
    return () => window.clearInterval(timer)
  }, [autoSync, online, syncNow])

  return {
    items,
    pendingCount: items.filter((s) => s.status === "pending").length,
    failed: items.filter((s) => s.status === "failed"),
    online,
    syncing,
    syncNow,
    discard: offlineSales.remove,
    retry: offlineSales.retry,
  }
}
