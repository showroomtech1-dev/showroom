import { useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useExpenseCategories, useSaveExpense, useSaveRecurringExpense } from "@/hooks/useExpenses"
import { useAccounts } from "@/hooks/useFinance"
import { toKobo } from "@/lib/money"
import { newClientRef, todayIso } from "@/lib/utils"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

interface RecordExpenseModalProps {
  open: boolean
  onClose: () => void
}

export function RecordExpenseModal({ open, onClose }: RecordExpenseModalProps) {
  const { activeBranchId } = useAuth()
  const categoriesQuery = useExpenseCategories()
  const accountsQuery = useAccounts()
  const saveExpense = useSaveExpense()

  const [categoryId, setCategoryId] = useState("")
  const [amountNaira, setAmountNaira] = useState("")
  const [method, setMethod] = useState<"cash" | "transfer" | "pos" | "cheque">("cash")
  const [accountId, setAccountId] = useState("")
  const [payee, setPayee] = useState("")
  const [description, setDescription] = useState("")
  const [expenseDate, setExpenseDate] = useState(todayIso())

  const handleSave = async () => {
    if (!categoryId || toKobo(amountNaira) <= 0) {
      return toast.error("Select category and enter valid amount")
    }
    try {
      await saveExpense.mutateAsync({
        payload: {
          clientRef: newClientRef(),
          branchId: activeBranchId || undefined,
          categoryId,
          amount: toKobo(amountNaira),
          method,
          accountId: accountId || undefined,
          payee: payee.trim() || undefined,
          description: description.trim() || undefined,
          expenseDate,
        },
      })
      toast.success("Expense recorded")
      setAmountNaira("")
      setDescription("")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record expense")
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Record Operating Expense">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Select
            label="Category *"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Select category..."
          />
          <Input
            label="Amount (₦) *"
            type="number"
            value={amountNaira}
            onChange={(e) => setAmountNaira(e.target.value)}
            data-cy="expense-amount"
          />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Select
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            options={[
              { value: "cash", label: "Cash" },
              { value: "transfer", label: "Transfer" },
              { value: "pos", label: "POS" },
              { value: "cheque", label: "Cheque" },
            ]}
          />
          <Select
            label="Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
            placeholder="Default"
          />
          <Input label="Date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </div>
        <Input label="Payee" value={payee} onChange={(e) => setPayee(e.target.value)} />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveExpense.isPending} data-cy="expense-submit">
            {saveExpense.isPending ? "Saving..." : "Save Expense"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface RecurringExpenseModalProps {
  open: boolean
  onClose: () => void
}

export function RecurringExpenseModal({ open, onClose }: RecurringExpenseModalProps) {
  const { activeBranchId } = useAuth()
  const categoriesQuery = useExpenseCategories()
  const saveRecurring = useSaveRecurringExpense()

  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [amountNaira, setAmountNaira] = useState("")
  const [method, setMethod] = useState<"cash" | "transfer" | "pos" | "cheque">("transfer")
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly")
  const [startDate, setStartDate] = useState(todayIso())

  const handleSave = async () => {
    if (!name.trim() || !categoryId || toKobo(amountNaira) <= 0) {
      return toast.error("Fill schedule name, category, and amount")
    }
    try {
      await saveRecurring.mutateAsync({
        payload: {
          branchId: activeBranchId || undefined,
          categoryId,
          name: name.trim(),
          amount: toKobo(amountNaira),
          method,
          frequency,
          startDate,
        },
      })
      toast.success("Recurring expense schedule saved")
      setName("")
      setAmountNaira("")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save schedule")
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New Recurring Expense Schedule">
      <div className="space-y-3">
        <Input
          label="Schedule Name *"
          placeholder="e.g. Showroom Monthly Rent"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Select
            label="Category *"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Select..."
          />
          <Input
            label="Amount (₦) *"
            type="number"
            value={amountNaira}
            onChange={(e) => setAmountNaira(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Select
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            options={[
              { value: "transfer", label: "Transfer" },
              { value: "cash", label: "Cash" },
              { value: "cheque", label: "Cheque" },
              { value: "pos", label: "POS" },
            ]}
          />
          <Select
            label="Frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as typeof frequency)}
            options={[
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveRecurring.isPending}>
            {saveRecurring.isPending ? "Saving..." : "Save Schedule"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
