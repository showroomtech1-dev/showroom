import { RefreshCw } from "lucide-react"
import { useAppUpdate } from "@/hooks/useAppUpdate"
import { Button } from "@/components/ui/button"

/** "A new version is available" — shown when a newer build was deployed. The user chooses when to reload. */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useAppUpdate()
  if (!updateAvailable) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-24 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-white p-3 shadow-xl dark:border-indigo-900 dark:bg-slate-900 lg:bottom-6"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">A new version is available</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Finish what you&apos;re doing, then update.</p>
      </div>
      <Button size="sm" onClick={applyUpdate} className="shrink-0">
        <RefreshCw className="h-3.5 w-3.5" />
        Update
      </Button>
    </div>
  )
}
