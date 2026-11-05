import React, { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { DatePickerField } from "@/components/ui/date-picker"

export function FieldTooltip({ text }: { text: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const iconRef = useRef<HTMLButtonElement>(null)

  const show = () => {
    if (iconRef.current) {
      setRect(iconRef.current.getBoundingClientRect())
    }
  }

  const hide = () => setRect(null)

  const width = 248
  const left = rect
    ? Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12)
    : 0
  const showBelow = rect ? rect.top < 110 : false
  const top = rect ? (showBelow ? rect.bottom + 8 : rect.top - 8) : 0

  return (
    <>
      <button
        ref={iconRef}
        type="button"
        tabIndex={0}
        aria-label={text}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (rect) hide()
          else show()
        }}
        className="inline-flex items-center justify-center rounded-full text-slate-400 transition-colors hover:text-indigo-600 focus:text-indigo-600 focus:outline-none dark:text-slate-500 dark:hover:text-indigo-400 cursor-help"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
      </button>
      {rect &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top,
              left,
              width,
              transform: showBelow ? "none" : "translateY(-100%)",
            }}
            className="pointer-events-none z-[150] rounded-xl border border-slate-700/80 bg-slate-900/98 px-3.5 py-2.5 text-xs font-normal leading-relaxed text-slate-100 shadow-2xl ring-1 ring-white/10 backdrop-blur-md dark:border-slate-700 dark:bg-slate-800"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  )
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  tooltip?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, tooltip, id, type, value, onChange, disabled, ...props }, ref) => {
    const dataCy = (props as Record<string, unknown>)["data-cy"] as string | undefined

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor={id}
              title={label}
              className="block truncate whitespace-nowrap text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300"
            >
              {label}
            </label>
            {tooltip && <FieldTooltip text={tooltip} />}
          </div>
        )}
        {type === "date" ? (
          <DatePickerField
            id={id}
            value={String(value ?? "")}
            disabled={disabled}
            data-cy={dataCy}
            className={cn(error && "border-rose-500", className)}
            onChange={(iso) => {
              onChange?.({
                target: { value: iso },
                currentTarget: { value: iso },
              } as React.ChangeEvent<HTMLInputElement>)
            }}
          />
        ) : (
          <input
            id={id}
            ref={ref}
            type={type}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
              error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20",
              className
            )}
            {...props}
          />
        )}
        {error ? (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
        ) : hint ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = "Input"
