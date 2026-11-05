import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useCreateSupplierPayment, useSupplierStatement } from "@/hooks/useSuppliers"
import { useAccounts } from "@/hooks/useFinance"
import { SupplierEndpoints } from "@/endpoints/supplier.endpoints"
import { formatMoney, fromKobo, toKobo } from "@/lib/money"
import { formatDate, newClientRef, startOfMonthIso, todayIso } from "@/lib/utils"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import type { Supplier } from "@/types/supplier.types"

interface SupplierPaymentModalProps {
  supplier: Supplier | null
  onClose: () => void
}

export function SupplierPaymentModal({ supplier, onClose }: SupplierPaymentModalProps) {
  const { activeBranchId } = useAuth()
  const accountsQuery = useAccounts()
  const createPayment = useCreateSupplierPayment()
  const [amountNaira, setAmountNaira] = useState("")
  const [method, setMethod] = useState<"cash" | "transfer" | "pos" | "cheque">("transfer")
  const [accountId, setAccountId] = useState("")
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [reference, setReference] = useState("")

  useEffect(() => {
    if (supplier && supplier.balance > 0) {
      setAmountNaira(String(fromKobo(supplier.balance)))
    } else {
      setAmountNaira("")
    }
  }, [supplier])

  if (!supplier) return null

  const handlePay = async () => {
    const amtKobo = toKobo(amountNaira)
    if (amtKobo <= 0) return toast.error("Enter a valid payment amount")
    try {
      const res = await createPayment.mutateAsync({
        clientRef: newClientRef(),
        supplierId: supplier.id,
        branchId: activeBranchId || undefined,
        amount: amtKobo,
        method,
        accountId: accountId || undefined,
        paymentDate,
        reference: reference.trim() || undefined,
      })
      if (res.warning) {
        toast.warning(res.warning)
      } else {
        toast.success("Supplier payment recorded")
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment")
    }
  }

  return (
    <Dialog
      open={Boolean(supplier)}
      onClose={onClose}
      title={`Pay Supplier — ${supplier.name}`}
      description={`Outstanding Balance: ${formatMoney(supplier.balance)}`}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Amount Paid (₦)"
            type="number"
            value={amountNaira}
            onChange={(e) => setAmountNaira(e.target.value)}
            data-cy="supplier-pay-amount"
          />
          <Input
            label="Date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Select
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            options={[
              { value: "transfer", label: "Bank Transfer" },
              { value: "cash", label: "Cash" },
              { value: "cheque", label: "Cheque" },
              { value: "pos", label: "POS" },
            ]}
          />
          <Select
            label="From Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
            placeholder="Default Account"
          />
        </div>
        <Input label="Bank Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={createPayment.isPending} data-cy="supplier-pay-submit">
            {createPayment.isPending ? "Saving..." : "Record Payment"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface SupplierStatementModalProps {
  supplier: Supplier | null
  onClose: () => void
}

export function SupplierStatementModal({ supplier, onClose }: SupplierStatementModalProps) {
  const [from] = useState(startOfMonthIso())
  const [to] = useState(todayIso())
  const stmtQuery = useSupplierStatement(supplier?.id ?? "", { from, to })

  if (!supplier) return null

  return (
    <Dialog
      open={Boolean(supplier)}
      onClose={onClose}
      title={`${supplier.name} (${supplier.code})`}
      description={`Payable Balance: ${formatMoney(supplier.balance)}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-3 text-xs">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => SupplierEndpoints.downloadStatement(supplier.id, "pdf", { from, to })}
          >
            <Download className="h-3.5 w-3.5" />
            PDF Statement
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Supplied</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(stmtQuery.data?.entries ?? []).map((e, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{formatDate(e.date)}</td>
                  <td className="px-3 py-2 font-mono">{e.reference}</td>
                  <td className="px-3 py-2">{e.description}</td>
                  <td className="px-3 py-2 text-right">{e.supplied > 0 ? formatMoney(e.supplied) : "—"}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{e.paid > 0 ? formatMoney(e.paid) : "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatMoney(e.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  )
}
