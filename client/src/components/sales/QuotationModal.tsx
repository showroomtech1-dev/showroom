import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useSaleBranch } from "@/hooks/useSaleBranch"
import { useStockLevels } from "@/hooks/useInventory"
import { useCustomers } from "@/hooks/useCustomers"
import { useAccounts } from "@/hooks/useFinance"
import { useConvertQuotation, useSaveQuotation } from "@/hooks/useSales"
import { formatMoney, fromKobo, toKobo } from "@/lib/money"
import { newClientRef } from "@/lib/utils"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import type { Quotation } from "@/types/sale.types"

interface QuotationModalProps {
  open: boolean
  onClose: () => void
}

export function QuotationModal({ open, onClose }: QuotationModalProps) {
  const { saleBranch, saleBranchId } = useSaleBranch()
  const levelsQuery = useStockLevels({ limit: 100, branchId: saleBranchId || undefined })
  const customersQuery = useCustomers({ limit: 100 })
  const saveQuotation = useSaveQuotation()

  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("")
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const [lines, setLines] = useState<
    Array<{ variantId: string; label: string; quantity: number; unitPriceNaira: string; maxQty: number }>
  >([])

  const variants = levelsQuery.data?.data ?? []

  const addLine = () => {
    const v = variants.find((x) => x.variantId === selectedVariantId)
    if (!v) return
    const label = v.variantName !== "Default" ? `${v.productName} (${v.variantName})` : v.productName
    // Check stock up front (at the branch the sale would come from) instead of failing at conversion.
    if (v.quantity <= 0) return toast.error(`${label} is out of stock`)
    const existing = lines.find((l) => l.variantId === v.variantId)
    if (existing) {
      if (existing.quantity + 1 > v.quantity) return toast.error(`Only ${v.quantity} ${v.unit} of ${label} in stock`)
      setLines((prev) =>
        prev.map((l) => (l.variantId === v.variantId ? { ...l, quantity: l.quantity + 1, maxQty: v.quantity } : l))
      )
    } else {
      setLines((prev) => [
        ...prev,
        {
          variantId: v.variantId,
          label,
          quantity: 1,
          unitPriceNaira: String(fromKobo(v.sellingPrice)),
          maxQty: v.quantity,
        },
      ])
    }
    setSelectedVariantId("")
  }

  const handleSave = async () => {
    if (lines.length === 0) return toast.error("Add at least one item to the quotation")
    const short = lines.find((l) => l.quantity > l.maxQty)
    if (short) return toast.error(`Only ${short.maxQty} of ${short.label} in stock — reduce the quantity`)
    try {
      await saveQuotation.mutateAsync({
        payload: {
          branchId: saleBranchId || undefined,
          customerId: customerId || undefined,
          customerName: !customerId && customerName.trim() ? customerName.trim() : undefined,
          customerPhone: !customerId && customerPhone.trim() ? customerPhone.trim() : undefined,
          validUntil: validUntil || undefined,
          notes: notes.trim() || undefined,
          terms: terms.trim() || undefined,
          items: lines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
            unitPrice: toKobo(l.unitPriceNaira),
          })),
        },
      })
      toast.success("Quotation created")
      setLines([])
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create quotation")
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Create Quotation / Proforma" maxWidth="max-w-2xl">
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Select
            label="Existing Customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            options={(customersQuery.data?.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Or enter name manually"
          />
          <Input
            label="Recipient Name"
            placeholder="If not in customer list"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            disabled={Boolean(customerId)}
          />
          <Input
            label="Valid Until"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select
              label="Add Product / Variant"
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              options={variants.map((v) => ({
                value: v.variantId,
                label: `${v.productName} (${v.sku}) - ${formatMoney(v.sellingPrice)}`,
                badge: v.quantity > 0 ? `${v.quantity} in stock` : "Out of stock",
              }))}
              placeholder="Select item..."
              hint={saleBranch ? `Stock shown for ${saleBranch.name}` : undefined}
            />
          </div>
          <Button type="button" onClick={addLine} disabled={!selectedVariantId}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-800">
              <span className="col-span-5 min-w-0 wrap-break-word font-medium">{line.label}</span>
              <div className="col-span-3">
                <Input
                  type="number"
                  min={1}
                  max={line.maxQty}
                  value={line.quantity}
                  hint={`${line.maxQty} in stock`}
                  error={line.quantity > line.maxQty ? `Only ${line.maxQty} available` : undefined}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, idx) =>
                        idx === i
                          ? { ...row, quantity: Math.min(row.maxQty, Math.max(1, Math.floor(Number(e.target.value)) || 1)) }
                          : row
                      )
                    )
                  }
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  value={line.unitPriceNaira}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, idx) =>
                        idx === i ? { ...row, unitPriceNaira: e.target.value } : row
                      )
                    )
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                className="col-span-1 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Input label="Payment / Delivery Terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveQuotation.isPending}>
            {saveQuotation.isPending ? "Saving..." : "Save Quotation"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface ConvertQuotationDialogProps {
  quotation: Quotation | null
  onClose: () => void
}

export function ConvertQuotationDialog({ quotation, onClose }: ConvertQuotationDialogProps) {
  const convertMutation = useConvertQuotation()
  const accountsQuery = useAccounts()
  const [method, setMethod] = useState<"cash" | "transfer" | "pos" | "cheque">("transfer")
  const [accountId, setAccountId] = useState("")
  const [amountNaira, setAmountNaira] = useState("")

  if (!quotation) return null

  const handleConvert = async () => {
    const amtKobo = amountNaira ? toKobo(amountNaira) : quotation.total
    try {
      await convertMutation.mutateAsync({
        id: quotation.id,
        payload: {
          clientRef: newClientRef(),
          payments: amtKobo > 0 ? [{ method, accountId: accountId || undefined, amount: amtKobo }] : [],
        },
      })
      toast.success(`Quotation ${quotation.code} converted to sale`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to convert quotation")
    }
  }

  return (
    <Dialog
      open={Boolean(quotation)}
      onClose={onClose}
      title={`Convert ${quotation.code} to Sale`}
      description={`Total invoice amount: ${formatMoney(quotation.total)}`}
    >
      <div className="space-y-3">
        <Select
          label="Payment Method"
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          options={[
            { value: "cash", label: "Cash" },
            { value: "transfer", label: "Bank Transfer" },
            { value: "pos", label: "POS Card" },
            { value: "cheque", label: "Cheque" },
          ]}
        />
        <Select
          label="Receiving Account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
          placeholder="Default Account"
        />
        <Input
          label={`Amount Paid (₦) — Leave blank for full ${fromKobo(quotation.total)}`}
          type="number"
          placeholder={String(fromKobo(quotation.total))}
          value={amountNaira}
          onChange={(e) => setAmountNaira(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={convertMutation.isPending}>
            {convertMutation.isPending ? "Converting..." : "Convert & Record Sale"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
