import { useState } from "react"
import { Ban, ExternalLink, FileText, MessageCircle, Printer, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useCreateSaleReturn, useSale, useShareSale, useVoidSale } from "@/hooks/useSales"
import { useAccounts } from "@/hooks/useFinance"
import { SaleEndpoints } from "@/endpoints/sale.endpoints"
import { formatMoney, toKobo } from "@/lib/money"
import { formatDateTime } from "@/lib/utils"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/StatusBadge"

interface SaleDetailModalProps {
  saleId: string | null
  onClose: () => void
}

export function SaleDetailModal({ saleId, onClose }: SaleDetailModalProps) {
  const { can } = useAuth()
  const saleQuery = useSale(saleId ?? "")
  const voidSale = useVoidSale()
  const createReturn = useCreateSaleReturn()
  const shareSale = useShareSale()
  const accountsQuery = useAccounts()

  const [mode, setMode] = useState<"view" | "void" | "return">("view")
  const [voidReason, setVoidReason] = useState("")
  const [returnReason, setReturnReason] = useState("")
  const [refundAmountNaira, setRefundAmountNaira] = useState("")
  const [refundMethod, setRefundMethod] = useState<"cash" | "transfer" | "pos" | "cheque">("cash")
  const [refundAccountId, setRefundAccountId] = useState("")
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({})

  const sale = saleQuery.data

  const handleVoid = async () => {
    if (!sale || !voidReason.trim()) return toast.error("Please enter a reason to void this sale")
    try {
      await voidSale.mutateAsync({ id: sale.id, reason: voidReason.trim() })
      toast.success(`Sale ${sale.code} voided`)
      setMode("view")
      setVoidReason("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not void sale")
    }
  }

  const handleReturn = async () => {
    if (!sale) return
    const items = Object.entries(returnQtys)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity, restock: true }))
    if (items.length === 0) return toast.error("Select at least one item quantity to return")

    try {
      await createReturn.mutateAsync({
        saleId: sale.id,
        reason: returnReason.trim() || undefined,
        items,
        refundAmount: toKobo(refundAmountNaira),
        refundMethod: toKobo(refundAmountNaira) > 0 ? refundMethod : undefined,
        refundAccountId: toKobo(refundAmountNaira) > 0 && refundAccountId ? refundAccountId : undefined,
      })
      toast.success("Return processed")
      setMode("view")
      setReturnQtys({})
      setRefundAmountNaira("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process return")
    }
  }

  const handleShare = async () => {
    if (!sale) return
    try {
      const res = await shareSale.mutateAsync(sale.id)
      window.open(res.whatsappUrl, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not share receipt")
    }
  }

  return (
    <Dialog
      open={Boolean(saleId)}
      onClose={() => {
        setMode("view")
        onClose()
      }}
      title={sale ? `Sale ${sale.code}` : "Sale Details"}
      description={sale ? `${formatDateTime(sale.soldAt)} • Sold by ${sale.soldByName}` : ""}
      maxWidth="max-w-2xl"
    >
      {!sale ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading sale details...</p>
      ) : (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {sale.customerName || "Walk-in Customer"}{" "}
                {sale.customerPhone ? `(${sale.customerPhone})` : ""}
              </p>
              <p className="text-slate-500">{sale.branchName}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={sale.status} />
              <StatusBadge status={sale.paymentStatus} />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  {mode === "return" && <th className="px-3 py-2 text-right">Return Qty</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sale.items.map((item) => {
                  const maxReturnable = item.quantity - item.returnedQuantity
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                        {item.productName}
                        {item.variantName && item.variantName !== "Default" ? ` (${item.variantName})` : ""}
                        {item.returnedQuantity > 0 && (
                          <span className="ml-1 text-[10px] text-amber-600">
                            ({item.returnedQuantity} returned)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatMoney(item.lineTotal)}</td>
                      {mode === "return" && (
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={maxReturnable}
                            value={returnQtys[item.id] ?? 0}
                            onChange={(e) =>
                              setReturnQtys((prev) => ({
                                ...prev,
                                [item.id]: Math.min(maxReturnable, Math.max(0, Number(e.target.value))),
                              }))
                            }
                            className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-right dark:border-slate-700 dark:bg-slate-800"
                          />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
              <p className="text-slate-500">Total</p>
              <p className="mt-0.5 text-sm font-bold">{formatMoney(sale.total)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
              <p className="text-slate-500">Amount Paid</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-600">{formatMoney(sale.amountPaid)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
              <p className="text-slate-500">Balance Due</p>
              <p className="mt-0.5 text-sm font-bold text-rose-600">{formatMoney(sale.balanceDue)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
              <p className="text-slate-500">Returned</p>
              <p className="mt-0.5 text-sm font-bold">{formatMoney(sale.returnedAmount)}</p>
            </div>
          </div>

          {mode === "void" && (
            <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
              <Input
                label="Reason for Voiding Sale"
                placeholder="e.g. Entered wrong items or duplicate entry"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setMode("view")}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={handleVoid} disabled={voidSale.isPending}>
                  {voidSale.isPending ? "Voiding..." : "Confirm Void"}
                </Button>
              </div>
            </div>
          )}

          {mode === "return" && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input
                  label="Cash Refund (₦)"
                  type="number"
                  placeholder="0"
                  value={refundAmountNaira}
                  onChange={(e) => setRefundAmountNaira(e.target.value)}
                />
                <Select
                  label="Refund Method"
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as typeof refundMethod)}
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "transfer", label: "Transfer" },
                    { value: "pos", label: "POS" },
                    { value: "cheque", label: "Cheque" },
                  ]}
                />
                <Select
                  label="From Account"
                  value={refundAccountId}
                  onChange={(e) => setRefundAccountId(e.target.value)}
                  options={(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
                  placeholder="Default Account"
                />
              </div>
              <Input
                label="Return Reason"
                placeholder="e.g. Defective item or size exchange"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setMode("view")}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleReturn} disabled={createReturn.isPending}>
                  {createReturn.isPending ? "Processing..." : "Confirm Return"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" onClick={() => SaleEndpoints.openReceiptPdf(sale.id, "thermal")}>
                <Printer className="h-3.5 w-3.5" />
                Thermal
              </Button>
              <Button variant="outline" size="sm" onClick={() => SaleEndpoints.openReceiptPdf(sale.id, "a4")}>
                <FileText className="h-3.5 w-3.5" />
                A4 PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(`/r/${sale.receiptToken}`, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" />
                Public Link
              </Button>
            </div>
            {sale.status === "completed" && mode === "view" && (
              <div className="flex gap-1.5">
                {can("sale.return") && (
                  <Button variant="outline" size="sm" onClick={() => setMode("return")}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Return Items
                  </Button>
                )}
                {can("sale.void") && (
                  <Button variant="destructive" size="sm" onClick={() => setMode("void")}>
                    <Ban className="h-3.5 w-3.5" />
                    Void Sale
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
