import React from "react"
import { cn } from "@/lib/utils"
import { DatePickerField } from "@/components/ui/date-picker"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, type, value, onChange, disabled, ...props }, ref) => {
    const dataCy = (props as Record<string, unknown>)["data-cy"] as string | undefined

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            title={label}
            className="block truncate whitespace-nowrap text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
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
