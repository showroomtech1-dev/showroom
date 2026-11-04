// Pure cart maths (no I/O). All amounts are integer kobo; rates are basis points.
// Order: line discounts → cart discount → VAT (exclusive adds on top, inclusive is extracted).
import { applyBps, inclusiveTax, percentToBps } from "../../../shared/utils/money";

export interface PriceLine {
  quantity: number;
  unitPrice: number;
  /** Whole-line discount amount. */
  discount: number;
}

export interface CartDiscount {
  type: "amount" | "percent";
  /** Kobo when type = amount; 0–100 when type = percent. */
  value: number;
}

export interface TaxRule {
  enabled: boolean;
  rateBps: number;
  inclusive: boolean;
}

export interface PricedCart {
  lines: Array<{ gross: number; discount: number; lineTotal: number }>;
  /** Σ line totals (after line discounts). */
  subtotal: number;
  /** Cart-level discount. */
  discountTotal: number;
  taxRateBps: number;
  taxAmount: number;
  total: number;
}

export class PricingError extends Error {}

export function priceCart(lines: PriceLine[], cartDiscount: CartDiscount | undefined, tax: TaxRule): PricedCart {
  const priced = lines.map((line) => {
    const gross = line.quantity * line.unitPrice;
    if (line.discount > gross) throw new PricingError("A line discount cannot be more than the line amount");
    return { gross, discount: line.discount, lineTotal: gross - line.discount };
  });
  const subtotal = priced.reduce((s, l) => s + l.lineTotal, 0);

  let discountTotal = 0;
  if (cartDiscount && cartDiscount.value > 0) {
    discountTotal = cartDiscount.type === "percent" ? applyBps(subtotal, percentToBps(cartDiscount.value)) : cartDiscount.value;
  }
  if (discountTotal > subtotal) throw new PricingError("The discount cannot be more than the subtotal");

  const base = subtotal - discountTotal;
  const rate = tax.enabled ? tax.rateBps : 0;
  const taxAmount = rate === 0 ? 0 : tax.inclusive ? inclusiveTax(base, rate) : applyBps(base, rate);
  const total = tax.inclusive ? base : base + taxAmount;
  return { lines: priced, subtotal, discountTotal, taxRateBps: rate, taxAmount, total };
}

/**
 * Value of `quantity` units of a sale line as the customer actually paid for them — the line's
 * share of the cart discount removed and its share of exclusive VAT added (i.e. scaled by total/subtotal).
 */
export function returnValue(lineTotal: number, lineQuantity: number, quantity: number, saleSubtotal: number, saleTotal: number): number {
  if (lineQuantity <= 0 || saleSubtotal <= 0) return 0;
  return Math.round((lineTotal * quantity * saleTotal) / (lineQuantity * saleSubtotal));
}
