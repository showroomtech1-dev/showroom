import { Loader2 } from "lucide-react"

export function PageLoader({ message = "Loading workspace..." }: { message?: string }) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  )
}
