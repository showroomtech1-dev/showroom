import { useState } from "react"
import { usePersistedState } from "@/hooks/usePersistedState"
import { usePlatformLive } from "@/hooks/usePlatformLive"
import { BusinessesTab } from "@/components/platform/BusinessesTab"
import { LiveTab } from "@/components/platform/LiveTab"
import { OverviewTab } from "@/components/platform/OverviewTab"
import { LiveBadge } from "@/components/platform/PlatformBits"
import { UsersTab } from "@/components/platform/UsersTab"

type Tab = "overview" | "businesses" | "users" | "live"

const TABS: Array<[Tab, string]> = [
  ["overview", "Overview"],
  ["businesses", "Businesses & sign-ups"],
  ["users", "People"],
  ["live", "Who's online"],
]

/** Platform operators only (PLATFORM_ADMIN_EMAILS): every business on ShowroomPro at a glance. */
export default function PlatformAdminPage() {
  const live = usePlatformLive()
  const [tab, setTab] = usePersistedState<Tab>("platform_tab", "overview")
  const [userBusiness, setUserBusiness] = useState<{ id: string; name: string } | null>(null)

  return (
    <div className="space-y-4" data-cy="platform-admin-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Platform Admin</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Every business on ShowroomPro: sign-ups, people, last logins and who's online right now
          </p>
        </div>
        <LiveBadge status={live.status} onlineCount={live.onlineList.length} />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            data-cy={`platform-tab-${key}`}
            className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
              tab === key
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}
            {key === "live" && live.connected && (
              <span className={`ml-1.5 rounded-full px-1.5 text-[10px] font-bold ${tab === key ? "bg-white/20" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                {live.onlineList.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab live={live} onOpenBusinesses={() => setTab("businesses")} onOpenLive={() => setTab("live")} />}
      {tab === "businesses" && (
        <BusinessesTab
          live={live}
          onViewUsers={(business) => {
            setUserBusiness(business)
            setTab("users")
          }}
        />
      )}
      {tab === "users" && (
        <UsersTab key={userBusiness?.id ?? "all"} live={live} business={userBusiness} onClearBusiness={() => setUserBusiness(null)} />
      )}
      {tab === "live" && <LiveTab live={live} />}
    </div>
  )
}
