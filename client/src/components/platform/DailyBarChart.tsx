import { useState } from "react"

interface Point {
  date: string
  value: number
}

interface Props {
  title: string
  /** Unit for the readout, e.g. "new businesses". */
  unit: string
  data: Point[]
}

const dayLabel = (iso: string, withWeekday = false) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withWeekday ? { weekday: "short" } : {}),
  })

/**
 * One series, one hue: a bar per day on a zero baseline. Hover / focus / tap a day for its value;
 * the readout above the plot shows the latest day otherwise, so it also works on touch screens.
 */
export function DailyBarChart({ title, unit, data }: Props) {
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const max = Math.max(...data.map((d) => d.value), 1)
  const active = data.find((d) => d.date === activeDate) ?? data[data.length - 1]
  const labelEvery = Math.max(1, Math.ceil(data.length / 6))

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{title}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {total.toLocaleString()} in {data.length} days
          </p>
        </div>
        {active && (
          <p className="text-right text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-mono-num text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {active.value.toLocaleString()}
            </span>{" "}
            {unit}
            <br />
            {dayLabel(active.date, true)}
          </p>
        )}
      </div>

      <div className="relative h-32 border-b border-slate-200 dark:border-slate-700" role="list" aria-label={title}>
        <div className="flex h-full items-end gap-[2px]">
          {data.map((d) => {
            const dimmed = activeDate !== null && activeDate !== d.date
            const height = d.value === 0 ? 0 : Math.max((d.value / max) * 100, 3)
            return (
              <div
                key={d.date}
                role="listitem"
                tabIndex={0}
                aria-label={`${dayLabel(d.date, true)}: ${d.value} ${unit}`}
                onMouseEnter={() => setActiveDate(d.date)}
                onMouseLeave={() => setActiveDate(null)}
                onFocus={() => setActiveDate(d.date)}
                onBlur={() => setActiveDate(null)}
                onClick={() => setActiveDate(d.date)}
                className="relative flex h-full min-w-0 flex-1 cursor-default items-end outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <div
                  className={`w-full rounded-t-[4px] bg-indigo-500 transition-opacity dark:bg-indigo-400 ${dimmed ? "opacity-35" : ""}`}
                  style={{ height: `${height}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-[2px]">
        {data.map((d, i) => (
          <span key={d.date} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-[10px] text-slate-500 dark:text-slate-400">
            {i % labelEvery === 0 ? dayLabel(d.date) : ""}
          </span>
        ))}
      </div>
    </div>
  )
}
