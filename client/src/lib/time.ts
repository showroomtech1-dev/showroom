import { useEffect, useState } from "react"
import { NAV_SECTIONS } from "@/components/layout/nav"

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a date. */
export function timeAgo(value: string | Date | null | undefined, now = Date.now()): string {
  if (!value) return "Never"
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return "—"
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 45) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} d ago`
  return new Date(t).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
}

/** "12 min", "2 h 5 min". */
export function durationSince(value: string | Date, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - new Date(value).getTime()) / 60_000))
  if (m < 1) return "under a minute"
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
}

/** Re-renders every `intervalMs` so relative times stay current. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const PAGE_LABELS: Array<[string, string]> = [
  ...NAV_SECTIONS.flatMap((s) => s.items.map((i): [string, string] => [i.path, i.label])),
  ["/profile", "Profile"],
]

/** Friendly name for an app path ("/pos" → "Point of Sale"). */
export function pageLabel(path: string | null | undefined): string {
  if (!path) return "—"
  if (path === "/") return "Dashboard"
  const hit = PAGE_LABELS.find(([p]) => path === p || path.startsWith(`${p}/`))
  return hit ? hit[1] : path
}
