import { Activity, Building2, Info, LogIn, Package, Radio, ShoppingCart, Users } from "lucide-react"
import { usePlatformLogins, usePlatformOverview } from "@/hooks/usePlatform"
import type { PlatformLive } from "@/hooks/usePlatformLive"
import { timeAgo, useNow } from "@/lib/time"
import { formatDateTime } from "@/lib/utils"
import { StatCard } from "@/components/shared/StatCard"
import { PageLoader } from "@/components/shared/PageLoader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DailyBarChart } from "./DailyBarChart"
import { Initial } from "./PlatformBits"

interface Props {
  live: PlatformLive
  onOpenBusinesses: () => void
  onOpenLive: () => void
}

export function OverviewTab({ live, onOpenBusinesses, onOpenLive }: Props) {
  const now = useNow()
  const overviewQuery = usePlatformOverview(30)
  const loginsQuery = usePlatformLogins(12)
  const overview = overviewQuery.data

  if (overviewQuery.isLoading) return <PageLoader />
  if (!overview) {
    return <p className="py-10 text-center text-xs text-rose-600">Could not load the platform overview. Try again.</p>
  }

  const t = overview.totals
  // Prefer the live count once the socket is up; the API figure is a snapshot.
  const onlineNow = live.connected ? live.onlineList.length : t.onlineNow
  const onlineBusinesses = live.connected ? live.onlineByOrg.size : t.onlineBusinesses

  return (
    <div className="space-y-4">
      {!overview.realtime && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Live presence is off on this API server (it runs without Socket.io, e.g. on Vercel functions), so "online now" stays
            at zero. Last login and last seen still update.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Businesses"
          value={t.businesses.toLocaleString()}
          subtext={`+${t.signups7d} this week · ${t.signupsToday} today`}
          icon={<Building2 className="h-5 w-5" />}
          tone="indigo"
        />
        <StatCard
          label="Users"
          value={t.users.toLocaleString()}
          subtext={`+${t.newUsers7d} this week · ${t.neverLoggedIn} never signed in`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Online now"
          value={onlineNow.toLocaleString()}
          subtext={`in ${onlineBusinesses} business${onlineBusinesses === 1 ? "" : "es"}`}
          icon={<Radio className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Active (24 h)"
          value={t.activeLast24h.toLocaleString()}
          subtext={`${t.loggedInToday} signed in today · ${t.activeLast7d} this week`}
          icon={<Activity className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Sales today"
          value={t.salesToday.toLocaleString()}
          subtext={`${t.sales30d.toLocaleString()} in 30 days · ${t.sellingBusinesses30d} businesses selling`}
          icon={<ShoppingCart className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Products"
          value={t.products.toLocaleString()}
          subtext={`${t.customers.toLocaleString()} customers recorded${t.deactivatedUsers ? ` · ${t.deactivatedUsers} deactivated users` : ""}`}
          icon={<Package className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 30 days</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <DailyBarChart
            title="New businesses per day"
            unit="new businesses"
            data={overview.daily.map((d) => ({ date: d.date, value: d.signups }))}
          />
          <DailyBarChart
            title="People who signed in per day"
            unit="people signed in"
            data={overview.daily.map((d) => ({ date: d.date, value: d.logins }))}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Newest businesses</CardTitle>
            <button type="button" onClick={onOpenBusinesses} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer">
              See all
            </button>
          </CardHeader>
          <CardContent>
            {overview.recentSignups.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No businesses yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {overview.recentSignups.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-2.5">
                    <Initial name={b.name} online={(live.onlineByOrg.get(b.id) ?? 0) > 0} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{b.name}</p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {b.ownerName ?? "—"}
                        {b.ownerEmail ? ` · ${b.ownerEmail}` : ""}
                        {b.ownerPhone ? ` · ${b.ownerPhone}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400" title={formatDateTime(b.createdAt)}>
                      {timeAgo(b.createdAt, now)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent sign-ins</CardTitle>
            <button type="button" onClick={onOpenLive} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer">
              Who's online
            </button>
          </CardHeader>
          <CardContent>
            {loginsQuery.isLoading ? (
              <p className="py-6 text-center text-xs text-slate-400">Loading…</p>
            ) : (loginsQuery.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No sign-ins recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {(loginsQuery.data ?? []).map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5">
                    <Initial name={l.userName ?? "?"} online={l.userId ? live.online.has(l.userId) : false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                        {l.userName ?? "Unknown user"}
                        {l.method === "google" && (
                          <span className="ml-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Google
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {l.businessName}
                        {l.email ? ` · ${l.email}` : ""}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400" title={`${formatDateTime(l.createdAt)}${l.ip ? ` · IP ${l.ip}` : ""}`}>
                      <LogIn className="h-3 w-3" />
                      {timeAgo(l.createdAt, now)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
