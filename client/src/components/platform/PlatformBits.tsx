import { cn } from "@/lib/utils"
import type { SocketStatus } from "@/lib/socket"

export function OnlineDot({ online, className }: { online: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        online ? "bg-emerald-500 ring-2 ring-emerald-500/25" : "bg-slate-300 dark:bg-slate-600",
        className
      )}
      aria-label={online ? "Online" : "Offline"}
      title={online ? "Online now" : "Offline"}
    />
  )
}

const STATUS_TEXT: Record<SocketStatus, string> = {
  connected: "Live",
  connecting: "Connecting…",
  disconnected: "Reconnecting…",
  off: "Live updates off",
}

/** Connection state of the live feed, with the online count when connected. */
export function LiveBadge({ status, onlineCount }: { status: SocketStatus; onlineCount: number }) {
  const live = status === "connected"
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold",
        live
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      )}
      data-cy="platform-live-badge"
    >
      <span className="relative flex h-2 w-2">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", live ? "bg-emerald-500" : "bg-slate-400")} />
      </span>
      {STATUS_TEXT[status]}
      {live && <span className="font-mono-num">· {onlineCount} online</span>}
    </div>
  )
}

/** Small initial avatar used in the lists. */
export function Initial({ name, online }: { name: string; online?: boolean }) {
  return (
    <div className="relative shrink-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
        {name.charAt(0).toUpperCase() || "?"}
      </div>
      {online !== undefined && (
        <OnlineDot online={online} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-slate-900" />
      )}
    </div>
  )
}
