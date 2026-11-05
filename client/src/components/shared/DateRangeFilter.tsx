import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DateRangeFilterProps {
  from: string
  to: string
  onFromChange?: (val: string) => void
  onToChange?: (val: string) => void
  onChange?: (range: { from: string; to: string }) => void
  onClear?: () => void
}

export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onChange,
  onClear,
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={from}
        onChange={(e) => {
          onFromChange?.(e.target.value)
          onChange?.({ from: e.target.value, to })
        }}
        aria-label="From date"
        data-cy="date-from"
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      />
      <span className="text-xs text-slate-400">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => {
          onToChange?.(e.target.value)
          onChange?.({ from, to: e.target.value })
        }}
        aria-label="To date"
        data-cy="date-to"
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      />
      {(from || to) && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} data-cy="clear-dates">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  )
}
