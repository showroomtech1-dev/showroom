import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "—"
  const d = typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? new Date(`${dateStr}T00:00:00`)
    : new Date(dateStr)
  if (Number.isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function formatDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function startOfMonthIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}-01`
}

export function newClientRef(prefix = "ref"): string {
  const rand = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 20)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  return `${prefix}_${rand}`
}

export function humanizeLabel(value?: string | null): string {
  if (!value) return "—"
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
