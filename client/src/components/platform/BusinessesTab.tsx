import { useState } from "react"
import { Users } from "lucide-react"
import { usePlatformBusinesses } from "@/hooks/usePlatform"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import type { PlatformLive } from "@/hooks/usePlatformLive"
import { formatMoney } from "@/lib/money"
import { timeAgo, useNow } from "@/lib/time"
import { formatDate, formatDateTime } from "@/lib/utils"
import { Pagination } from "@/components/shared/Pagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { TableStatus } from "@/components/shared/TableStatus"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import type { BusinessSort, BusinessStatus } from "@/types/platform.types"
import { OnlineDot } from "./PlatformBits"

interface Props {
  live: PlatformLive
  onViewUsers: (business: { id: string; name: string }) => void
}

export function BusinessesTab({ live, onViewUsers }: Props) {
  const now = useNow()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<BusinessStatus | "">("")
  const [sort, setSort] = useState<BusinessSort>("newest")
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedSearch(search, 300, () => setPage(1))

  const query = usePlatformBusinesses({ page, limit: 20, search: debouncedSearch || undefined, status: status || undefined, sort })
  const rows = query.data?.data ?? []

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Business, owner, email or phone…" dataCy="platform-business-search" />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as BusinessStatus | "")
            setPage(1)
          }}
          placeholder="All businesses"
          options={[
            { value: "online", label: "Someone online now" },
            { value: "active7d", label: "Active in the last 7 days" },
            { value: "dormant", label: "Dormant (30+ days)" },
            { value: "neverSold", label: "Never made a sale" },
          ]}
        />
        <Select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as BusinessSort)
            setPage(1)
          }}
          options={[
            { value: "newest", label: "Newest sign-ups first" },
            { value: "oldest", label: "Oldest first" },
            { value: "lastActive", label: "Most recently active" },
            { value: "sales", label: "Most sales (30 days)" },
            { value: "name", label: "Name A–Z" },
          ]}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Last activity</th>
              <th className="px-4 py-3 text-right">Sales (30 d)</th>
              <th className="px-4 py-3">Set-up</th>
              <th className="px-4 py-3 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            <TableStatus loading={query.isLoading} error={query.isError} empty={rows.length === 0} cols={7} emptyText="No businesses match" />
            {rows.map((b) => {
              const onlineCount = live.connected ? (live.onlineByOrg.get(b.id) ?? 0) : b.onlineCount
              return (
                <tr key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{b.name}</p>
                    <p className="text-[11px] text-slate-500" title={formatDateTime(b.createdAt)}>
                      Signed up {formatDate(b.createdAt)} · {timeAgo(b.createdAt, now)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{b.ownerName ?? "—"}</p>
                    <p className="text-[11px] text-slate-500">{b.ownerEmail ?? "—"}</p>
                    {(b.ownerPhone || b.phone) && <p className="text-[11px] text-slate-500">{b.ownerPhone || b.phone}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-slate-800 dark:text-slate-200">
                      {b.activeUserCount}/{b.userCount} active
                    </p>
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <OnlineDot online={onlineCount > 0} />
                      {onlineCount > 0 ? `${onlineCount} online now` : "Nobody online"}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-slate-800 dark:text-slate-200" title={b.lastSeenAt ? formatDateTime(b.lastSeenAt) : undefined}>
                      Seen {timeAgo(b.lastSeenAt, now)}
                    </p>
                    <p className="text-[11px] text-slate-500" title={b.lastLoginAt ? formatDateTime(b.lastLoginAt) : undefined}>
                      Last login {timeAgo(b.lastLoginAt, now)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{formatMoney(b.salesTotal30d, b.currencySymbol, true)}</p>
                    <p className="text-[11px] text-slate-500">
                      {b.sales30d} sale{b.sales30d === 1 ? "" : "s"} · last {b.lastSaleAt ? timeAgo(b.lastSaleAt, now) : "never"}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-500">
                    {b.productCount} products · {b.customerCount} customers
                    <br />
                    {b.branchCount} branch{b.branchCount === 1 ? "" : "es"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => onViewUsers({ id: b.id, name: b.name })} data-cy="platform-view-users">
                      <Users className="h-3.5 w-3.5" />
                      Users
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Pagination meta={query.data?.meta} page={page} onPageChange={setPage} />
      </div>
    </div>
  )
}
