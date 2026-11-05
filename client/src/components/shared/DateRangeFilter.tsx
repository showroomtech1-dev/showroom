import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DatePickerField } from "@/components/ui/date-picker"

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
      <div className="w-38">
        <DatePickerField
          value={from}
          ariaLabel="From date"
          data-cy="date-from"
          onChange={(val) => {
            onFromChange?.(val)
            onChange?.({ from: val, to })
          }}
        />
      </div>
      <span className="text-xs text-slate-400">to</span>
      <div className="w-38">
        <DatePickerField
          value={to}
          ariaLabel="To date"
          data-cy="date-to"
          onChange={(val) => {
            onToChange?.(val)
            onChange?.({ from, to: val })
          }}
        />
      </div>
      {(from || to) && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} data-cy="clear-dates">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  )
}
