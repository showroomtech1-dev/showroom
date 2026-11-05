import { useState } from "react"
import { formatMoney } from "@/lib/money"

interface Props {
  data: Array<{ category: string; total: number }>
  currencySymbol: string
}

/** This month's expenses per category — sorted horizontal bars, one hue (magnitude, not identity). */
export function ExpenseCategoryChart({ data, currencySymbol }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const rows = [...data].sort((a, b) => b.total - a.total)
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
  const max = Math.max(...rows.map((r) => r.total), 1)

  if (rows.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-400">No expenses recorded this month yet.</p>
  }

  return (
    <div className="space-y-2.5" role="list" aria-label="Expenses by category this month">
      {rows.map((row) => {
        const share = grandTotal > 0 ? Math.round((row.total / grandTotal) * 100) : 0
        const width = Math.max((row.total / max) * 100, 2)
        const dimmed = active !== null && active !== row.category
        return (
          <div
            key={row.category}
            role="listitem"
            tabIndex={0}
            aria-label={`${row.category}: ${formatMoney(row.total, currencySymbol)}, ${share}% of expenses`}
            onMouseEnter={() => setActive(row.category)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(row.category)}
            onBlur={() => setActive(null)}
            className="group cursor-default rounded-lg py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{row.category}</span>
              <span className="shrink-0 text-slate-500 dark:text-slate-400">
                <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">{formatMoney(row.total, currencySymbol)}</span>
                <span className="ml-1.5">{share}%</span>
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                style={{ width: `${width}%` }}
                className={`h-2.5 rounded-full bg-indigo-500 transition-opacity dark:bg-indigo-400 ${dimmed ? "opacity-40" : ""}`}
              />
            </div>
          </div>
        )
      })}
      <p className="pt-1 text-right text-[11px] text-slate-500 dark:text-slate-400">
        Total <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">{formatMoney(grandTotal, currencySymbol)}</span>
      </p>
    </div>
  )
}
