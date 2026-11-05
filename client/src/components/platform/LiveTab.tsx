import { Building2, LogIn, LogOut, Radio, UserPlus } from "lucide-react"
import type { PlatformLive } from "@/hooks/usePlatformLive"
import { realtimeConfigured } from "@/lib/socket"
import { durationSince, pageLabel, timeAgo, useNow } from "@/lib/time"
import { formatDateTime } from "@/lib/utils"
import { EmptyState } from "@/components/shared/EmptyState"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LiveEvent } from "@/types/platform.types"
import { Initial } from "./PlatformBits"

const EVENT_ICON: Record<LiveEvent["kind"], { icon: typeof LogIn; className: string }> = {
  signup: { icon: UserPlus, className: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400" },
  login: { icon: LogIn, className: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400" },
  online: { icon: Radio, className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400" },
  offline: { icon: LogOut, className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
}

export function LiveTab({ live }: { live: PlatformLive }) {
  const now = useNow(15_000)

  if (!realtimeConfigured) {
    return (
      <EmptyState
        title="Live updates are turned off"
        message="This web app was built with VITE_SOCKET_ENABLED=false, so it doesn't connect for live presence."
        icon={<Radio className="h-6 w-6" />}
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Online now</CardTitle>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {live.onlineList.length} people · {live.onlineByOrg.size} businesses
          </span>
        </CardHeader>
        <CardContent>
          {!live.connected ? (
            <p className="py-8 text-center text-xs text-slate-400">Connecting to live updates…</p>
          ) : live.onlineList.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">Nobody is online right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800" data-cy="platform-online-list">
              {live.onlineList.map((u) => (
                <li key={u.userId} className="flex items-start gap-3 py-3">
                  <Initial name={u.name} online />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                      {u.name} <span className="font-normal text-slate-500">· {u.roleName}</span>
                    </p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {u.businessName}
                      {u.branchName ? ` · ${u.branchName}` : ""}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {u.email} · {u.device}
                      {u.connections > 1 ? ` · ${u.connections} tabs` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{pageLabel(u.currentPath)}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400" title={`Online since ${formatDateTime(u.onlineSince)}`}>
                      for {durationSince(u.onlineSince, now)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Live activity</CardTitle>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Sign-ups, sign-ins and people coming and going since you opened this page.</p>
        </CardHeader>
        <CardContent>
          {live.feed.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">Waiting for activity…</p>
          ) : (
            <ul className="max-h-[520px] space-y-2.5 overflow-y-auto pr-1" data-cy="platform-live-feed">
              {live.feed.map((e) => {
                const { icon: Icon, className } = EVENT_ICON[e.kind]
                return (
                  <li key={e.id} className="flex items-start gap-2.5">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${className}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{e.title}</p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{e.detail}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-400" title={formatDateTime(e.at)}>
                      {timeAgo(e.at, now)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
