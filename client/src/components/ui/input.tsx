import React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
            error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20",
            className
          )}
          {...props}
        />
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
