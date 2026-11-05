import React from "react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  subtitle?: string
  icon?: React.ReactNode
  tone?: "default" | "indigo" | "emerald" | "amber" | "rose"
  className?: string
}

export function StatCard({
  label,
  value,
  subtext,
  subtitle,
  icon,
  tone = "default",
  className,
}: StatCardProps) {
  const iconTones = {
    default: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
  }

  const secondary = subtext ?? subtitle

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/90 dark:bg-slate-900",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1.5 font-mono-num text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 truncate">
            {value}
          </p>
          {secondary && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{secondary}</p>}
        </div>
        {icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconTones[tone])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
