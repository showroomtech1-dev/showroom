import { useState } from "react"
import { X } from "lucide-react"
import { usePlatformUsers } from "@/hooks/usePlatform"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import type { PlatformLive } from "@/hooks/usePlatformLive"
import { pageLabel, timeAgo, useNow } from "@/lib/time"
import { formatDate, formatDateTime } from "@/lib/utils"
import { Pagination } from "@/components/shared/Pagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { TableStatus } from "@/components/shared/TableStatus"
import { Select } from "@/components/ui/select"
import type { UserSort, UserStatus } from "@/types/platform.types"
import { Initial } from "./PlatformBits"

interface Props {
  live: PlatformLive
  business: { id: string; name: string } | null
  onClearBusiness: () => void
}

export function UsersTab({ live, business, onClearBusiness }: Props) {
  const now = useNow()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<UserStatus | "">("")
  const [sort, setSort] = useState<UserSort>("recent")
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedSearch(search, 300, () => setPage(1))

  const query = usePlatformUsers({
    page,
    limit: 25,
    search: debouncedSearch || undefined,
    status: status || undefined,
    sort,
    organizationId: business?.id,
  })
  const rows = query.data?.data ?? []

  return (
    <div className="space-y-3">
      {business && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Showing people in</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-1 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            {business.name}
            <button type="button" onClick={onClearBusiness} className="rounded p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900 cursor-pointer" aria-label="Show all businesses">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Name, email, phone or business…" dataCy="platform-user-search" />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as UserStatus | "")
            setPage(1)
          }}
          placeholder="Everyone"
          options={[
            { value: "online", label: "Online now" },
            { value: "active24h", label: "Active in the last 24 h" },
            { value: "active7d", label: "Active in the last 7 days" },
            { value: "new7d", label: "Joined in the last 7 days" },
            { value: "neverLoggedIn", label: "Never signed in" },
            { value: "deactivated", label: "Deactivated" },
          ]}
        />
        <Select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as UserSort)
            setPage(1)
          }}
          options={[
            { value: "recent", label: "Newest accounts first" },
            { value: "lastSeen", label: "Most recently seen" },
            { value: "lastLogin", label: "Most recent login" },
            { value: "name", label: "Name A–Z" },
          ]}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Business &amp; role</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Last seen</th>
              <th className="px-4 py-3 text-right">Devices</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            <TableStatus loading={query.isLoading} error={query.isError} empty={rows.length === 0} cols={7} emptyText="No people match" />
            {rows.map((u) => {
              // Live presence beats the snapshot from when the page loaded.
              const liveEntry = live.online.get(u.id)
              const online = live.connected ? Boolean(liveEntry) : u.online
              const currentPath = liveEntry?.currentPath ?? u.currentPath
              const device = liveEntry?.device ?? u.device
              return (
                <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Initial name={u.name} online={online} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{u.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{u.email}</p>
                        {u.phone && <p className="truncate text-[11px] text-slate-500">{u.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{u.businessName}</p>
                    <p className="text-[11px] text-slate-500">
                      {u.roleName}
                      {u.branchName ? ` · ${u.branchName}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300" title={formatDateTime(u.createdAt)}>
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" title={u.lastLoginAt ? formatDateTime(u.lastLoginAt) : undefined}>
                    <span className={u.lastLoginAt ? "text-slate-700 dark:text-slate-200" : "text-amber-600 dark:text-amber-400"}>
                      {timeAgo(u.lastLoginAt, now)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {online ? (
                      <>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">Online now</p>
                        <p className="text-[11px] text-slate-500">
                          {pageLabel(currentPath)}
                          {device ? ` · ${device}` : ""}
                        </p>
                      </>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-200" title={u.lastSeenAt ? formatDateTime(u.lastSeenAt) : undefined}>
                        {timeAgo(u.lastSeenAt, now)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300" title="Devices still signed in">
                    {u.activeSessions}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.isActive ? "active" : "terminated"} label={u.isActive ? "Active" : "Deactivated"} />
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
