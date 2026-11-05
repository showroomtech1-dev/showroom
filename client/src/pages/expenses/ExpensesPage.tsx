import { useState } from "react"
import { CheckCircle2, Edit2, FastForward, Plus, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useDeleteExpense,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useExpenseReport,
  useExpenses,
  useRecordRecurringExpense,
  useRecurringExpenses,
  useSaveExpenseCategory,
  useSkipRecurringExpense,
  useUploadExpenseReceipt,
} from "@/hooks/useExpenses"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { formatMoney } from "@/lib/money"
import { formatDate, newClientRef, startOfMonthIso, todayIso } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { SearchInput } from "@/components/shared/SearchInput"
import { Pagination } from "@/components/shared/Pagination"
import { StatCard } from "@/components/shared/StatCard"
import { RecordExpenseModal, RecurringExpenseModal } from "@/components/expenses/ExpenseModal"

export default function ExpensesPage() {
  const { can, activeBranchId } = useAuth()
  const [tab, setTab] = useState<"expenses" | "recurring" | "categories">("expenses")
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [page, setPage] = useState(1)
  const [expModalOpen, setExpModalOpen] = useState(false)
  const [recModalOpen, setRecModalOpen] = useState(false)
  const [editCatId, setEditCatId] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState("")

  const debouncedSearch = useDebouncedSearch(search, 300, () => setPage(1))

  const expensesQuery = useExpenses({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    branchId: activeBranchId || undefined,
  })
  const categoriesQuery = useExpenseCategories()
  const recurringQuery = useRecurringExpenses({ branchId: activeBranchId || undefined })
  const reportQuery = useExpenseReport({
    from: startOfMonthIso(),
    to: todayIso(),
    branchId: activeBranchId || undefined,
    groupBy: "category",
  })
  const deleteExpense = useDeleteExpense()
  const uploadReceipt = useUploadExpenseReceipt()
  const recordRecurring = useRecordRecurringExpense()
  const skipRecurring = useSkipRecurringExpense()
  const saveCategory = useSaveExpenseCategory()
  const deleteCategory = useDeleteExpenseCategory()

  return (
    <div className="space-y-4" data-cy="expenses-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Operating Expenses</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track showroom overheads, recurring bills, and expense categories
          </p>
        </div>
        {can("expense.create") && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRecModalOpen(true)}>
              New Recurring Bill
            </Button>
            <Button size="sm" onClick={() => setExpModalOpen(true)} data-cy="record-expense-btn">
              <Plus className="h-4 w-4" /> Record Expense
            </Button>
          </div>
        )}
      </div>

      <StatCard label="This Month Total Expenses" value={formatMoney(reportQuery.data?.total ?? 0)} tone="rose" />

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {([["expenses", "Expenses Ledger"], ["recurring", "Recurring Bills"], ["categories", "Categories & Breakdown"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setTab(k); setPage(1) }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
              tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "expenses" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search payee, description, code..." />
            <Select
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setPage(1) }}
              options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              placeholder="All Categories"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Payee / Description</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(expensesQuery.data?.data ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-mono font-semibold">{e.code}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(e.expenseDate)}</td>
                    <td className="px-4 py-3 font-medium">{e.categoryName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.payee || e.description || "—"}</td>
                    <td className="px-4 py-3 uppercase text-slate-500">{e.method}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">{formatMoney(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <label className="cursor-pointer rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <Upload className="h-3.5 w-3.5" />
                          <input
                            type="file"
                            className="hidden"
                            onChange={(ev) => {
                              const f = ev.target.files?.[0]
                              if (f) uploadReceipt.mutate({ id: e.id, file: f })
                            }}
                          />
                        </label>
                        {can("expense.delete") && (
                          <Button variant="ghost" size="icon" onClick={() => deleteExpense.mutate(e.id)} className="text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={expensesQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      {tab === "recurring" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Next Due</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(recurringQuery.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3">{r.categoryName}</td>
                  <td className="px-4 py-3 uppercase text-slate-500">{r.frequency}</td>
                  <td className="px-4 py-3">{formatDate(r.nextDueDate)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatMoney(r.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => recordRecurring.mutate({ id: r.id, payload: { clientRef: newClientRef() } })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Record Now
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => skipRecurring.mutate(r.id)}>
                        <FastForward className="h-3.5 w-3.5" /> Skip
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "categories" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {editCatId ? "Edit Expense Category" : "New Expense Category"}
              </h3>
              {editCatId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditCatId(null)
                    setNewCatName("")
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <Input
              label="Category Name *"
              placeholder="e.g. Diesel & Generator"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <div className="flex gap-2">
              {editCatId && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditCatId(null)
                    setNewCatName("")
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button
                className="flex-1"
                disabled={saveCategory.isPending}
                onClick={async () => {
                  if (!newCatName.trim()) return toast.error("Category name is required")
                  try {
                    await saveCategory.mutateAsync({
                      id: editCatId ?? undefined,
                      name: newCatName.trim(),
                    })
                    toast.success(editCatId ? "Expense category updated" : "Expense category added")
                    setEditCatId(null)
                    setNewCatName("")
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not save category")
                  }
                }}
              >
                {saveCategory.isPending
                  ? "Saving..."
                  : editCatId
                    ? "Update Category"
                    : "Add Category"}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Records</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(categoriesQuery.data ?? []).map((c) => {
                  const isEditing = editCatId === c.id
                  return (
                    <tr
                      key={c.id}
                      className={
                        isEditing
                          ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      }
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {c.name}
                      </td>
                      <td className="px-4 py-3 text-right">{c.expenseCount}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit category"
                            onClick={() => {
                              setEditCatId(c.id)
                              setNewCatName(c.name)
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          {!c.isSystem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete category"
                              onClick={async () => {
                                try {
                                  await deleteCategory.mutateAsync(c.id)
                                  if (editCatId === c.id) {
                                    setEditCatId(null)
                                    setNewCatName("")
                                  }
                                  toast.success("Expense category deleted")
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error ? err.message : "Could not delete category"
                                  )
                                }
                              }}
                              className="text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RecordExpenseModal open={expModalOpen} onClose={() => setExpModalOpen(false)} />
      <RecurringExpenseModal open={recModalOpen} onClose={() => setRecModalOpen(false)} />
    </div>
  )
}
