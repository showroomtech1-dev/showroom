import { useState } from "react"
import { CheckCircle2, Save, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useAdjustStock,
  useCancelStockTake,
  useCompleteStockTake,
  useRecordStockCounts,
  useStockTake,
  useStockTakeItems,
  useTransferStock,
} from "@/hooks/useInventory"
import { useBranches } from "@/hooks/useOrganization"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import type { StockLevelRow } from "@/types/inventory.types"

interface AdjustStockModalProps {
  row: StockLevelRow | null
  onClose: () => void
}

export function AdjustStockModal({ row, onClose }: AdjustStockModalProps) {
  const { activeBranchId } = useAuth()
  const adjustStock = useAdjustStock()
  const [mode, setMode] = useState<"change" | "set">("change")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("correction")
  const [note, setNote] = useState("")

  if (!row) return null

  const handleSave = async () => {
    const qty = Number(quantity)
    if (Number.isNaN(qty) || (mode === "change" && qty === 0)) {
      return toast.error("Enter a valid quantity")
    }
    try {
      await adjustStock.mutateAsync({
        variantId: row.variantId,
        branchId: row.branchId || activeBranchId || undefined,
        mode,
        quantity: qty,
        reason,
        note: note.trim() || undefined,
      })
      toast.success("Stock adjusted")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not adjust stock")
    }
  }

  return (
    <Dialog
      open={Boolean(row)}
      onClose={onClose}
      title={`Adjust Stock — ${row.productName}`}
      description={`SKU: ${row.sku} • Current Quantity: ${row.quantity}`}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Select
            label="Adjustment Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "change" | "set")}
            options={[
              { value: "change", label: "Add / Remove (+/-)" },
              { value: "set", label: "Set Exact Count" },
            ]}
          />
          <Input
            label={mode === "change" ? "Quantity Change (+/-)" : "New Stock Level"}
            type="number"
            placeholder={mode === "change" ? "-2 or 5" : "10"}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            data-cy="adjust-stock-qty"
          />
        </div>
        <Select
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={[
            { value: "correction", label: "Count Correction" },
            { value: "damage", label: "Damaged Goods" },
            { value: "theft", label: "Loss / Theft" },
            { value: "expired", label: "Expired" },
            { value: "gift", label: "Sample / Gift" },
            { value: "other", label: "Other (Specify below)" },
          ]}
        />
        <Input label="Notes" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={adjustStock.isPending} data-cy="adjust-stock-submit">
            {adjustStock.isPending ? "Saving..." : "Apply Adjustment"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface TransferStockModalProps {
  row: StockLevelRow | null
  onClose: () => void
}

export function TransferStockModal({ row, onClose }: TransferStockModalProps) {
  const { activeBranchId } = useAuth()
  const branchesQuery = useBranches()
  const transferStock = useTransferStock()
  const [fromBranchId, setFromBranchId] = useState(activeBranchId ?? "")
  const [toBranchId, setToBranchId] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [note, setNote] = useState("")

  if (!row) return null

  const handleTransfer = async () => {
    if (!toBranchId) return toast.error("Select destination branch")
    const qty = Number(quantity)
    if (qty <= 0) return toast.error("Enter a valid transfer quantity")
    try {
      await transferStock.mutateAsync({
        fromBranchId: fromBranchId || undefined,
        toBranchId,
        note: note.trim() || undefined,
        items: [{ variantId: row.variantId, quantity: qty }],
      })
      toast.success("Branch stock transfer completed")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer failed")
    }
  }

  return (
    <Dialog open={Boolean(row)} onClose={onClose} title={`Transfer Stock — ${row.productName}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Select
            label="From Branch"
            value={fromBranchId}
            onChange={(e) => setFromBranchId(e.target.value)}
            options={(branchesQuery.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
            placeholder="Main Branch"
          />
          <Select
            label="To Branch *"
            value={toBranchId}
            onChange={(e) => setToBranchId(e.target.value)}
            options={(branchesQuery.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
            placeholder="Select destination..."
          />
        </div>
        <Input
          label="Quantity to Transfer"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={transferStock.isPending}>
            {transferStock.isPending ? "Transferring..." : "Transfer Stock"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface StockTakeSheetModalProps {
  stockTakeId: string | null
  onClose: () => void
}

export function StockTakeSheetModal({ stockTakeId, onClose }: StockTakeSheetModalProps) {
  const takeQuery = useStockTake(stockTakeId ?? "")
  const itemsQuery = useStockTakeItems(stockTakeId ?? "", { limit: 200 })
  const recordCounts = useRecordStockCounts()
  const completeTake = useCompleteStockTake()
  const cancelTake = useCancelStockTake()
  const [counts, setCounts] = useState<Record<string, string>>({})

  const take = takeQuery.data
  const items = itemsQuery.data?.data ?? []

  const handleSaveCounts = async () => {
    if (!stockTakeId) return
    const payload = Object.entries(counts)
      .filter(([, val]) => val !== "")
      .map(([variantId, val]) => ({ variantId, countedQuantity: Math.max(0, Number(val)) }))
    if (payload.length === 0) return toast.error("Enter at least one counted quantity")
    try {
      await recordCounts.mutateAsync({ id: stockTakeId, counts: payload })
      toast.success("Counts saved")
      itemsQuery.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save counts")
    }
  }

  return (
    <Dialog
      open={Boolean(stockTakeId)}
      onClose={onClose}
      title={take ? `Stock Take ${take.code}` : "Stock Count Sheet"}
      description={take ? `${take.branchName} • ${take.itemsCounted}/${take.totalItems} counted` : ""}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 text-xs">
        <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 text-right">System Qty</th>
                <th className="px-3 py-2 text-right">Counted Qty</th>
                <th className="px-3 py-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {items.map((item) => {
                const currentVal =
                  counts[item.variantId] !== undefined
                    ? counts[item.variantId]
                    : item.countedQuantity !== null
                      ? String(item.countedQuantity)
                      : ""
                const variance =
                  currentVal !== "" ? Number(currentVal) - item.systemQuantity : item.variance
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium">{item.productName}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{item.sku}</td>
                    <td className="px-3 py-2 text-right">{item.systemQuantity}</td>
                    <td className="px-3 py-2 text-right">
                      {take?.status === "in_progress" ? (
                        <input
                          type="number"
                          min={0}
                          value={currentVal}
                          onChange={(e) =>
                            setCounts((prev) => ({ ...prev, [item.variantId]: e.target.value }))
                          }
                          className="w-20 rounded border border-slate-300 px-2 py-0.5 text-right dark:border-slate-700 dark:bg-slate-800"
                        />
                      ) : (
                        <span>{item.countedQuantity ?? "—"}</span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${
                        variance && variance < 0
                          ? "text-rose-600"
                          : variance && variance > 0
                            ? "text-blue-600"
                            : "text-slate-500"
                      }`}
                    >
                      {variance !== null ? (variance > 0 ? `+${variance}` : variance) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {take?.status === "in_progress" && (
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await cancelTake.mutateAsync(take.id)
                toast.success("Stock take cancelled")
                onClose()
              }}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel Session
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveCounts} disabled={recordCounts.isPending}>
                <Save className="h-3.5 w-3.5" />
                Save Counts
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await completeTake.mutateAsync(take.id)
                    toast.success("Stock take completed and inventory updated")
                    onClose()
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not complete stock take")
                  }
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete & Post Variances
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
