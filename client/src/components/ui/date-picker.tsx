import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
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

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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
  const [pickerMode, setPickerMode] = useState<"days" | "months" | "years">("days")
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

  const prevStep = () => {
    if (pickerMode === "years") {
      setViewYear((y) => y - 12)
    } else if (pickerMode === "months") {
      setViewYear((y) => y - 1)
    } else if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextStep = () => {
    if (pickerMode === "years") {
      setViewYear((y) => y + 12)
    } else if (pickerMode === "months") {
      setViewYear((y) => y + 1)
    } else if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const today = todayIso()
  const top =
    anchorRect.bottom + 320 > window.innerHeight && anchorRect.top > 320
      ? anchorRect.top - 312
      : anchorRect.bottom + 6
  const left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - 296)

  const cells: Array<number | null> = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const yearGridStart = viewYear - 5

  return createPortal(
    <div
      ref={popRef}
      style={{ top, left }}
      className="fixed z-[120] w-72 rounded-2xl border border-slate-200/90 bg-white/98 p-3.5 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/98 dark:ring-white/10 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Month / Year Header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevStep}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPickerMode((m) => (m === "months" ? "days" : "months"))}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors cursor-pointer",
              pickerMode === "months"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                : "text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            )}
          >
            {MONTH_NAMES[viewMonth]}
            <ChevronDown
              className={cn(
                "h-3 w-3 text-slate-400 transition-transform",
                pickerMode === "months" && "rotate-180 text-indigo-500"
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => setPickerMode((m) => (m === "years" ? "days" : "years"))}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors cursor-pointer",
              pickerMode === "years"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                : "text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            )}
          >
            {viewYear}
            <ChevronDown
              className={cn(
                "h-3 w-3 text-slate-400 transition-transform",
                pickerMode === "years" && "rotate-180 text-indigo-500"
              )}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={nextStep}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {pickerMode === "months" ? (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {MONTH_SHORT.map((m, idx) => {
            const active = idx === viewMonth
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setViewMonth(idx)
                  setPickerMode("days")
                }}
                className={cn(
                  "flex h-9 items-center justify-center rounded-xl text-xs font-semibold transition-colors cursor-pointer",
                  active
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                )}
              >
                {m}
              </button>
            )
          })}
        </div>
      ) : pickerMode === "years" ? (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {Array.from({ length: 12 }, (_, i) => yearGridStart + i).map((yr) => {
            const active = yr === viewYear
            return (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setViewYear(yr)
                  setPickerMode("days")
                }}
                className={cn(
                  "flex h-9 items-center justify-center rounded-xl text-xs font-semibold transition-colors cursor-pointer",
                  active
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                )}
              >
                {yr}
              </button>
            )
          })}
        </div>
      ) : (
        <>
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
        </>
      )}

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
