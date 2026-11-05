import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn, todayIso } from "@/lib/utils"

interface CalendarPopoverProps {
  value: string
  onSelect: (isoDate: string) => void
  onClose: () => void
  anchorRect: DOMRect
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function parseIsoParts(iso: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim())
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]) - 1,
      day: Number(match[3]),
    }
  }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() }
}

function toIsoString(year: number, monthZeroBased: number, day: number): string {
  const m = String(monthZeroBased + 1).padStart(2, "0")
  const d = String(day).padStart(2, "0")
  return `${year}-${m}-${d}`
}

function formatDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim())
  if (!match) return iso || "Select date..."
  return `${match[3]}/${match[2]}/${match[1]}`
}

function CalendarPopover({ value, onSelect, onClose, anchorRect }: CalendarPopoverProps) {
  const initial = useMemo(() => parseIsoParts(value), [value])
  const [viewYear, setViewYear] = useState(initial.year)
  const [viewMonth, setViewMonth] = useState(initial.month)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const today = todayIso()
  const top =
    anchorRect.bottom + 310 > window.innerHeight && anchorRect.top > 310
      ? anchorRect.top - 304
      : anchorRect.bottom + 6
  const left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - 288)

  const cells: Array<number | null> = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return createPortal(
    <div
      ref={popRef}
      style={{ top, left }}
      className="fixed z-[100] w-70 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Month / Year Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5">
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="rounded-lg bg-transparent px-1 py-0.5 text-xs font-bold text-slate-900 focus:outline-none dark:text-slate-100 cursor-pointer"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="rounded-lg bg-transparent px-1 py-0.5 text-xs font-bold text-slate-900 focus:outline-none dark:text-slate-100 cursor-pointer"
          >
            {Array.from({ length: 15 }, (_, i) => viewYear - 7 + i).map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-8" />
          }
          const iso = toIsoString(viewYear, viewMonth, day)
          const isSelected = iso === value
          const isToday = iso === today
          return (
            <button
              key={iso}
              type="button"
              onClick={() => {
                onSelect(iso)
                onClose()
              }}
              className={cn(
                "flex h-8 w-full items-center justify-center rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                isSelected
                  ? "bg-indigo-600 text-white shadow-xs"
                  : isToday
                    ? "border border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              )}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Footer shortcuts */}
      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            onSelect(today)
            onClose()
          }}
          className="text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  )
}

export interface DatePickerButtonProps {
  id?: string
  value: string
  onChange: (isoDate: string) => void
  className?: string
  disabled?: boolean
  "data-cy"?: string
  ariaLabel?: string
}

export function DatePickerField({
  id,
  value,
  onChange,
  className,
  disabled,
  "data-cy": dataCy,
  ariaLabel,
}: DatePickerButtonProps) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const toggleOpen = () => {
    if (disabled) return
    if (!open && btnRef.current) {
      setRect(btnRef.current.getBoundingClientRect())
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        id={id}
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        aria-label={ariaLabel}
        data-cy={dataCy}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-left text-sm font-medium text-slate-900 transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 cursor-pointer",
          open && "border-indigo-500 ring-2 ring-indigo-500/20",
          className
        )}
      >
        <span className="truncate font-mono text-xs sm:text-sm">{formatDisplayDate(value)}</span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && rect && (
        <CalendarPopover
          value={value}
          anchorRect={rect}
          onSelect={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
