// Integer money helpers. Amounts are minor units (kobo); rates are basis points (1 bp = 0.01 %).

/** amount × rate, rounded half-up to the nearest minor unit. */
export function applyBps(amount: number, rateBps: number): number {
  return Math.round((amount * rateBps) / 10_000);
}

/** Tax contained in a tax-inclusive amount. */
export function inclusiveTax(amountInclusive: number, rateBps: number): number {
  if (rateBps <= 0) return 0;
  return Math.round((amountInclusive * rateBps) / (10_000 + rateBps));
}

/** Percentage (0–100, up to 2 dp) → basis points. */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/** Split `total` across `weights` so the parts always add up exactly to `total`. */
export function allocateProportionally(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const parts = weights.map((w) => Math.floor((total * w) / sum));
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  for (let i = 0; remainder > 0 && i < parts.length; i += 1, remainder -= 1) parts[i] += 1;
  return parts;
}

/** Postgres SUM/COUNT come back as strings — normalise to number. */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(amountMinor: number, symbol: string): string {
  const major = amountMinor / 100;
  const sign = major < 0 ? "-" : "";
  const formatted = Math.abs(major).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${symbol}${formatted}`;
}
