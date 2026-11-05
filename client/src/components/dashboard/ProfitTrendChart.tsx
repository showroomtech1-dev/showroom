import { useState } from "react"
import { formatMoney } from "@/lib/money"
import type { DashboardCharts } from "@/types/dashboard.types"

interface Props {
  data: DashboardCharts["profitByMonth"]
  currencySymbol: string
}

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })

/**
 * Net profit per month on a zero baseline: profit grows up (emerald), a loss grows down (rose).
 * Hover / focus a month for the revenue → cost → expenses → payroll breakdown.
 */
export function ProfitTrendChart({ data, currencySymbol }: Props) {
  const [activeMonth, setActiveMonth] = useState<string | null>(null)
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-400">No profit figures yet.</p>
  }

  const maxUp = Math.max(...data.map((d) => d.netProfit), 0)
  const maxDown = Math.max(...data.map((d) => -d.netProfit), 0)
  const range = maxUp + maxDown || 1
  // Share of the plot height above the zero line.
  const upShare = maxUp / range
  const active = data.find((d) => d.month === activeMonth) ?? data[data.length - 1]
  const money = (v: number) => formatMoney(v, currencySymbol)

  return (
    <div>
      {/* Readout for the hovered (or latest) month — doubles as the tooltip on touch screens. */}
      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-[11px] dark:border-slate-800 dark:bg-slate-800/40 sm:grid-cols-5">
        <div className="col-span-2 sm:col-span-1">
          <p className="font-bold text-slate-900 dark:text-slate-100">{monthLabel(active.month)}</p>
          <p className={`font-mono-num text-sm font-extrabold ${active.netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {active.netProfit >= 0 ? "" : "−"}
            {money(Math.abs(active.netProfit))}
          </p>
          <p className="text-slate-500">{active.netProfit >= 0 ? "net profit" : "net loss"}</p>
        </div>
        {[
          ["Revenue", active.revenue],
          ["Cost of goods", active.cogs],
          ["Expenses", active.expenses],
          ["Payroll", active.payroll],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="text-slate-500">{label}</p>
            <p className="font-mono-num font-bold text-slate-900 dark:text-slate-100">{money(value as number)}</p>
          </div>
        ))}
      </div>

      <div className="relative h-44" role="list" aria-label="Net profit by month">
        {/* Zero baseline */}
        <div className="absolute inset-x-0 border-t border-slate-300 dark:border-slate-600" style={{ top: `${upShare * 100}%` }} aria-hidden />
        <div className="flex h-full items-stretch gap-2">
          {data.map((d) => {
            const isProfit = d.netProfit >= 0
            const size = (Math.abs(d.netProfit) / range) * 100
            const dimmed = activeMonth !== null && activeMonth !== d.month
            return (
              <div
                key={d.month}
                role="listitem"
                tabIndex={0}
                aria-label={`${monthLabel(d.month)}: ${isProfit ? "profit" : "loss"} ${money(Math.abs(d.netProfit))}`}
                onMouseEnter={() => setActiveMonth(d.month)}
                onMouseLeave={() => setActiveMonth(null)}
                onFocus={() => setActiveMonth(d.month)}
                onBlur={() => setActiveMonth(null)}
                onClick={() => setActiveMonth(d.month)}
                className="relative flex-1 cursor-default outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <div
                  className={`absolute inset-x-1 sm:inset-x-2 transition-opacity ${isProfit ? "rounded-t-[4px] bg-emerald-500 dark:bg-emerald-400" : "rounded-b-[4px] bg-rose-500 dark:bg-rose-400"} ${dimmed ? "opacity-40" : ""}`}
                  style={
                    isProfit
                      ? { bottom: `${(1 - upShare) * 100}%`, height: `${Math.max(size, d.netProfit === 0 ? 0 : 1)}%` }
                      : { top: `${upShare * 100}%`, height: `${Math.max(size, 1)}%` }
                  }
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center text-[10px] font-mono text-slate-500 dark:text-slate-400">
            {monthLabel(d.month)}
          </span>
        ))}
      </div>
    </div>
  )
}
