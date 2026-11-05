import React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <textarea
          id={id}
          ref={ref}
          className={cn(
            "flex min-h-[84px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
            error && "border-rose-500",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = "Textarea"
