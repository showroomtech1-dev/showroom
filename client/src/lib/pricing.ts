// Mirrors the server's cart maths (server/modules/sale/domain/pricing.ts) so the till always shows
// exactly what will be charged. Integer kobo throughout; rates in basis points (750 = 7.5 %).

export interface CartTotals {
  subtotal: number
  discount: number
  taxAmount: number
  total: number
  /** VAT already included in the prices (true) or added on top (false). */
  taxInclusive: boolean
}

export interface TaxRule {
  taxEnabled: boolean
  taxRateBps: number
  taxInclusive: boolean
}

const applyBps = (amount: number, bps: number) => Math.round((amount * bps) / 10_000)

export function priceCart(
  subtotal: number,
  discount: { type: "amount" | "percent"; value: number } | null,
  tax: TaxRule | undefined
): CartTotals {
  let discountTotal = 0
  if (discount && discount.value > 0) {
    discountTotal =
      discount.type === "percent"
        ? applyBps(subtotal, Math.round(Math.min(100, discount.value) * 100))
        : Math.round(discount.value)
  }
  discountTotal = Math.min(discountTotal, subtotal)
  const base = subtotal - discountTotal
  const rate = tax?.taxEnabled ? tax.taxRateBps : 0
  const inclusive = Boolean(tax?.taxInclusive)
  const taxAmount = rate === 0 ? 0 : inclusive ? Math.round((base * rate) / (10_000 + rate)) : applyBps(base, rate)
  return { subtotal, discount: discountTotal, taxAmount, total: inclusive ? base : base + taxAmount, taxInclusive: inclusive }
}
