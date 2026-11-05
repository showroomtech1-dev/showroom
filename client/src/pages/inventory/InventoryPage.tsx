import { useState } from "react"
import { ArrowRightLeft, ClipboardList, Plus, Sliders } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useInventoryValuation,
  useStartStockTake,
  useStockAlerts,
  useStockLevels,
  useStockMovements,
  useStockTakes,
} from "@/hooks/useInventory"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { formatMoney } from "@/lib/money"
import { formatDateTime, humanizeLabel } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { SearchInput } from "@/components/shared/SearchInput"
import { StatCard } from "@/components/shared/StatCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import {
  AdjustStockModal,
  StockTakeSheetModal,
  TransferStockModal,
} from "@/components/inventory/StockTakeModal"
import type { StockLevelRow } from "@/types/inventory.types"

export default function InventoryPage() {
  const { can, activeBranchId } = useAuth()
  const [tab, setTab] = useState<"levels" | "movements" | "takes" | "valuation">("levels")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [adjustTarget, setAdjustTarget] = useState<StockLevelRow | null>(null)
  const [transferTarget, setTransferTarget] = useState<StockLevelRow | null>(null)
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedSearch(search, 300, () => setPage(1))

  const levelsQuery = useStockLevels({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    branchId: activeBranchId || undefined,
  })
  const alertsQuery = useStockAlerts(activeBranchId || undefined)
  const movementsQuery = useStockMovements({
    page,
    limit: 20,
    branchId: activeBranchId || undefined,
  })
  const takesQuery = useStockTakes({
    page,
    limit: 20,
    branchId: activeBranchId || undefined,
  })
  const valuationQuery = useInventoryValuation(activeBranchId || undefined)
  const startTake = useStartStockTake()

  const handleStartTake = async () => {
    try {
      const created = await startTake.mutateAsync({
        branchId: activeBranchId || undefined,
      })
      toast.success(`Stock take ${created.code} started`)
      setActiveTakeId(created.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start stock take")
    }
  }

  return (
    <div className="space-y-4" data-cy="inventory-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Inventory & Stock Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time stock levels, movements, physical stock-takes, and branch transfers
          </p>
        </div>
        {can("inventory.stocktake") && (
          <Button size="sm" onClick={handleStartTake} disabled={startTake.isPending}>
            <Plus className="h-4 w-4" />
            Start Stock Take
          </Button>
        )}
      </div>

      {alertsQuery.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="Low Stock Variants" value={String(alertsQuery.data.low)} tone="amber" />
          <StatCard label="Out of Stock Variants" value={String(alertsQuery.data.out)} tone="rose" />
          <StatCard
            label="Retail Stock Value"
            value={formatMoney(valuationQuery.data?.valueAtSelling ?? 0)}
            tone="emerald"
          />
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            ["levels", "Stock Levels"],
            ["movements", "Movement Ledger"],
            ["takes", "Stock Takes"],
            ["valuation", "Stock Valuation"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setTab(k)
              setPage(1)
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
              tab === k
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "levels" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search item, SKU, barcode..." />
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              options={[
                { value: "attention", label: "Needs Attention (Low or Out)" },
                { value: "low", label: "Low Stock" },
                { value: "out", label: "Out of Stock" },
                { value: "in_stock", label: "In Stock" },
              ]}
              placeholder="All Stock Statuses"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Item / Variant</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Reorder</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Selling Value</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(levelsQuery.data?.data ?? []).map((row) => (
                  <tr key={row.variantId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {row.productName}
                      {row.variantName && row.variantName !== "Default" ? ` (${row.variantName})` : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{row.sku}</td>
                    <td className="px-4 py-3 text-right font-bold">{row.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{row.reorderLevel}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(row.valueAtSelling)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {can("inventory.adjust") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAdjustTarget(row)}
                            title="Adjust Stock"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                            Adjust
                          </Button>
                        )}
                        {can("inventory.transfer") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTransferTarget(row)}
                            title="Branch Transfer"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={levelsQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      {tab === "movements" && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="px-4 py-3 text-right">Balance After</th>
                  <th className="px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(movementsQuery.data?.data ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{m.productName}</td>
                    <td className="px-4 py-3">{humanizeLabel(m.type)}</td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        m.quantityChange >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{m.balanceAfter}</td>
                    <td className="px-4 py-3 text-slate-500">{m.createdByName || "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={movementsQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      {tab === "takes" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(takesQuery.data?.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-mono font-semibold">{t.code}</td>
                  <td className="px-4 py-3">{t.branchName}</td>
                  <td className="px-4 py-3">
                    {t.itemsCounted} / {t.totalItems} items
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setActiveTakeId(t.id)}>
                      <ClipboardList className="h-3.5 w-3.5" />
                      Open Sheet
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "valuation" && valuationQuery.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Units in Stock" value={String(valuationQuery.data.totalUnits)} />
          {valuationQuery.data.valueAtCost !== null && (
            <StatCard label="Value at Cost" value={formatMoney(valuationQuery.data.valueAtCost)} />
          )}
          <StatCard label="Value at Selling Price" value={formatMoney(valuationQuery.data.valueAtSelling)} tone="emerald" />
        </div>
      )}

      <AdjustStockModal row={adjustTarget} onClose={() => setAdjustTarget(null)} />
      <TransferStockModal row={transferTarget} onClose={() => setTransferTarget(null)} />
      <StockTakeSheetModal stockTakeId={activeTakeId} onClose={() => setActiveTakeId(null)} />
    </div>
  )
}
