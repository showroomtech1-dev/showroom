// Sales recorded while the device can't reach the server. They are kept on this device and sent
// when the connection is back. Each carries its `clientRef`, so a retry can never create a
// duplicate sale on the server.
import { SaleEndpoints } from "@/endpoints/sale.endpoints"

export interface PendingSale {
  /** Who made the sale — it only syncs while that person is signed in, so it is credited to them. */
  userId: string
  clientRef: string
  payload: Record<string, unknown>
  createdAt: string
  summary: { items: number; total: number; customer: string | null }
  status: "pending" | "failed"
  /** Why the server refused it (e.g. out of stock) — needs a person to look at it. */
  error?: string
}

const KEY = "showroompro.pendingSales.v1"
const CHANGED = "showroompro:pending-sales"

function read(): PendingSale[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PendingSale[]) : []
  } catch {
    return []
  }
}

function write(list: PendingSale[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked — nothing more we can do here.
  }
  window.dispatchEvent(new Event(CHANGED))
}

export const offlineSales = {
  list: read,

  add(sale: Omit<PendingSale, "status" | "createdAt">): void {
    write([...read().filter((s) => s.clientRef !== sale.clientRef), { ...sale, status: "pending", createdAt: new Date().toISOString() }])
  },

  remove(clientRef: string): void {
    write(read().filter((s) => s.clientRef !== clientRef))
  },

  /** Put a failed sale back in the queue (after fixing stock, for example). */
  retry(clientRef: string): void {
    write(read().map((s) => (s.clientRef === clientRef ? { ...s, status: "pending", error: undefined } : s)))
  },

  subscribe(listener: () => void): () => void {
    const onStorage = (e: StorageEvent) => e.key === KEY && listener()
    window.addEventListener(CHANGED, listener)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(CHANGED, listener)
      window.removeEventListener("storage", onStorage)
    }
  },
}

let syncing: Promise<{ synced: number; failed: number }> | null = null

/**
 * Sends every pending sale. Network problems leave a sale pending (tried again later); a refusal
 * from the server marks it failed with the reason. Only one sync runs at a time.
 */
export function syncPendingSales(userId: string): Promise<{ synced: number; failed: number }> {
  if (syncing) return syncing
  syncing = (async () => {
    let synced = 0
    let failed = 0
    for (const sale of read().filter((s) => s.status === "pending" && s.userId === userId)) {
      if (!navigator.onLine) break
      const res = await SaleEndpoints.create(sale.payload)
      if (res.success) {
        offlineSales.remove(sale.clientRef)
        synced += 1
      } else if (res.statusCode === 0 || res.statusCode >= 500 || res.statusCode === 401 || res.statusCode === 429) {
        break // still offline, server trouble or signed out — keep it and try later
      } else {
        write(read().map((s) => (s.clientRef === sale.clientRef ? { ...s, status: "failed", error: res.message } : s)))
        failed += 1
      }
    }
    return { synced, failed }
  })().finally(() => {
    syncing = null
  })
  return syncing
}

/** True when a failed request means "couldn't reach the server" rather than "the server said no". */
export function isConnectivityFailure(statusCode: number): boolean {
  return statusCode === 0 || !navigator.onLine
}
