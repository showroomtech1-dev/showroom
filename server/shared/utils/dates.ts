// Date helpers. Date-only values are 'YYYY-MM-DD' strings in the business's timezone.

export function todayIn(timeZone: string): string {
  return toDateIn(new Date(), timeZone);
}

export function toDateIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export function endOfMonth(dateStr: string): string {
  const d = new Date(`${startOfMonth(dateStr)}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/** Inclusive number of calendar days between two dates. */
export function daysBetweenInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((b - a) / 86_400_000) + 1;
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Default report window: the current month to today. */
export function resolveRange(timeZone: string, from?: string, to?: string): { from: string; to: string } {
  const today = todayIn(timeZone);
  const resolvedTo = to ?? today;
  const resolvedFrom = from ?? startOfMonth(resolvedTo);
  return resolvedFrom <= resolvedTo ? { from: resolvedFrom, to: resolvedTo } : { from: resolvedTo, to: resolvedFrom };
}

/** Minutes between "HH:MM" and a Date, in the given timezone (positive when `at` is later). */
export function minutesAfter(timeHHMM: string, at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  const [h, m] = parts.split(":").map(Number);
  const [sh, sm] = timeHHMM.split(":").map(Number);
  return h * 60 + m - (sh * 60 + sm);
}
