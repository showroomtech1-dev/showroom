import { useEffect, useState } from "react"
import { Download, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useCreateCustomerPayment,
  useCustomerPurchases,
  useCustomerReminder,
  useCustomerStatement,
  useSaveCustomer,
} from "@/hooks/useCustomers"
import { useAccounts } from "@/hooks/useFinance"
import { CustomerEndpoints } from "@/endpoints/customer.endpoints"
import { formatMoney, fromKobo, toKobo } from "@/lib/money"
import { formatDate, newClientRef, startOfMonthIso, todayIso } from "@/lib/utils"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import type { Customer } from "@/types/customer.types"

interface CustomerEditorModalProps {
  open: boolean
  customer: Customer | null
  onClose: () => void
}

export function CustomerEditorModal({ open, customer, onClose }: CustomerEditorModalProps) {
  const saveCustomer = useSaveCustomer()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [creditLimitNaira, setCreditLimitNaira] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (customer) {
      setName(customer.name)
      setPhone(customer.phone ?? "")
      setEmail(customer.email ?? "")
      setAddress(customer.address ?? "")
      setCreditLimitNaira(customer.creditLimit ? String(fromKobo(customer.creditLimit)) : "")
      setNotes(customer.notes ?? "")
    } else {
      setName("")
      setPhone("")
      setEmail("")
      setAddress("")
      setCreditLimitNaira("")
      setNotes("")
    }
  }, [customer, open])

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Customer name is required")
    try {
      await saveCustomer.mutateAsync({
        id: customer?.id,
        payload: {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          creditLimit: creditLimitNaira ? toKobo(creditLimitNaira) : null,
          notes: notes.trim() || null,
        },
      })
      toast.success(customer ? "Customer updated" : "Customer added")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save customer")
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={customer ? "Edit Customer" : "Add Customer"}>
      <div className="space-y-3">
        <Input label="Full Name *" value={name} onChange={(e) => setName(e.target.value)} data-cy="customer-name" />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} data-cy="customer-phone" />
          <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Input
            label="Credit Limit (₦)"
            type="number"
            placeholder="No limit"
            value={creditLimitNaira}
            onChange={(e) => setCreditLimitNaira(e.target.value)}
          />
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveCustomer.isPending} data-cy="customer-save">
            {saveCustomer.isPending ? "Saving..." : "Save Customer"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface CustomerPaymentModalProps {
  customer: Customer | null
  onClose: () => void
}

export function CustomerPaymentModal({ customer, onClose }: CustomerPaymentModalProps) {
  const { activeBranchId } = useAuth()
  const accountsQuery = useAccounts()
  const createPayment = useCreateCustomerPayment()
  const [amountNaira, setAmountNaira] = useState("")
  const [method, setMethod] = useState<"cash" | "transfer" | "pos" | "cheque">("transfer")
  const [accountId, setAccountId] = useState("")
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (customer && customer.balance > 0) {
      setAmountNaira(String(fromKobo(customer.balance)))
    } else {
      setAmountNaira("")
    }
  }, [customer])

  if (!customer) return null

  const handleRecord = async () => {
    const amtKobo = toKobo(amountNaira)
    if (amtKobo <= 0) return toast.error("Enter a valid payment amount")
    try {
      await createPayment.mutateAsync({
        clientRef: newClientRef(),
        customerId: customer.id,
        branchId: activeBranchId || undefined,
        amount: amtKobo,
        method,
        accountId: accountId || undefined,
        paymentDate,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      toast.success("Customer payment recorded")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment")
    }
  }

  return (
    <Dialog
      open={Boolean(customer)}
      onClose={onClose}
      title={`Record Payment — ${customer.name}`}
      description={`Current Balance: ${formatMoney(customer.balance)}`}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Amount Received (₦)"
            type="number"
            value={amountNaira}
            onChange={(e) => setAmountNaira(e.target.value)}
            data-cy="cust-payment-amount"
          />
          <Input label="Date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Select
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            options={[
              { value: "cash", label: "Cash" },
              { value: "transfer", label: "Bank Transfer" },
              { value: "pos", label: "POS" },
              { value: "cheque", label: "Cheque" },
            ]}
          />
          <Select
            label="Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
            placeholder="Default Account"
          />
        </div>
        <Input label="Reference / Teller No." value={reference} onChange={(e) => setReference(e.target.value)} />
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleRecord} disabled={createPayment.isPending} data-cy="cust-payment-submit">
            {createPayment.isPending ? "Saving..." : "Record Payment"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface CustomerStatementModalProps {
  customer: Customer | null
  onClose: () => void
}

export function CustomerStatementModal({ customer, onClose }: CustomerStatementModalProps) {
  const [from] = useState(startOfMonthIso())
  const [to] = useState(todayIso())
  const statementQuery = useCustomerStatement(customer?.id ?? "", { from, to })
  const purchasesQuery = useCustomerPurchases(customer?.id ?? "", { limit: 10 })
  const reminderMutation = useCustomerReminder()

  if (!customer) return null
  const stmt = statementQuery.data

  const handleReminder = async () => {
    try {
      const res = await reminderMutation.mutateAsync(customer.id)
      window.open(res.whatsappUrl, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate reminder")
    }
  }

  return (
    <Dialog
      open={Boolean(customer)}
      onClose={onClose}
      title={`${customer.name} (${customer.code})`}
      description={`Balance: ${formatMoney(customer.balance)} • Total Purchases: ${formatMoney(customer.totalPurchases)}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => CustomerEndpoints.downloadStatement(customer.id, "pdf", { from, to })}
            >
              <Download className="h-3.5 w-3.5" />
              PDF Statement
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => CustomerEndpoints.downloadStatement(customer.id, "xlsx", { from, to })}
            >
              <Download className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>
          {customer.balance > 0 && (
            <Button variant="outline" size="sm" onClick={handleReminder} disabled={reminderMutation.isPending}>
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              WhatsApp Debt Reminder
            </Button>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
                <th className="px-3 py-2 text-right">Running Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(stmt?.entries ?? []).map((e, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2">{formatDate(e.date)}</td>
                  <td className="px-3 py-2 font-mono">{e.reference}</td>
                  <td className="px-3 py-2">{e.description}</td>
                  <td className="px-3 py-2 text-right text-rose-600">{e.debit > 0 ? formatMoney(e.debit) : "—"}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{e.credit > 0 ? formatMoney(e.credit) : "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatMoney(e.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(purchasesQuery.data?.data ?? []).length > 0 && (
          <div>
            <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-300">Recent Purchases</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(purchasesQuery.data?.data ?? []).slice(0, 4).map((s) => (
                <div key={s.id} className="flex justify-between rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                  <span>{s.code} • {formatDate(s.soldAt)}</span>
                  <span className="font-semibold">{formatMoney(s.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
