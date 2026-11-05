import React from "react"
import { Inbox } from "lucide-react"

interface EmptyStateProps {
  title?: string
  message: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ title = "Nothing here yet", message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h4>
      <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
