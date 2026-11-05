/**
 * All backend monetary values are stored in minor units (kobo: ₦1.00 = 100).
 * Rates are in basis points (750 = 7.5%).
 */

export function formatMoney(kobo?: number | null, symbol = "₦", compact = false): string {
  if (kobo === undefined || kobo === null || Number.isNaN(Number(kobo))) return "—"
  const major = Number(kobo) / 100
  const neg = major < 0
  const abs = Math.abs(major)

  if (compact && abs >= 1_000_000) {
    return `${neg ? "-" : ""}${symbol}${(abs / 1_000_000).toFixed(2)}M`
  }

  const formatted = abs.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${neg ? "-" : ""}${symbol}${formatted}`
}

/** Converts user-entered major unit (e.g. Naira "1500.50") to integer kobo (150050). */
export function toKobo(majorAmount: string | number): number {
  const num = typeof majorAmount === "string" ? parseFloat(majorAmount.replace(/,/g, "")) : majorAmount
  if (Number.isNaN(num)) return 0
  return Math.round(num * 100)
}

/** Converts integer kobo (150050) to major unit number (1500.5) for inputs. */
export function fromKobo(kobo?: number | null): number {
  if (!kobo) return 0
  return Math.round(Number(kobo)) / 100
}

/** Converts basis points (750) to display percentage ("7.5%"). */
export function formatBps(bps?: number | null): string {
  if (bps === undefined || bps === null) return "0%"
  return `${(Number(bps) / 100).toFixed(2).replace(/\.?0+$/, "")}%`
}

export function toBps(percent: string | number): number {
  const num = typeof percent === "string" ? parseFloat(percent) : percent
  if (Number.isNaN(num)) return 0
  return Math.round(num * 100)
}

export function fromBps(bps?: number | null): number {
  if (!bps) return 0
  return Number(bps) / 100
}
