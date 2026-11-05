import { useState } from "react"
import { CheckCircle2, Lock } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useCashupPreview, useCashups, useCloseCashup, useCommissions } from "@/hooks/useSales"
import { useAccounts } from "@/hooks/useFinance"
import { formatMoney, toKobo } from "@/lib/money"
import { formatDate, startOfMonthIso, todayIso } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"

export function CashupPanel() {
  const { activeBranchId } = useAuth()
  const [date, setDate] = useState(todayIso())
  const [accountId, setAccountId] = useState("")
  const [countedNaira, setCountedNaira] = useState("")
  const [notes, setNotes] = useState("")
  const [postAdjustment, setPostAdjustment] = useState(false)

  const accountsQuery = useAccounts()
  const previewQuery = useCashupPreview({
    date,
    branchId: activeBranchId || undefined,
    accountId: accountId || undefined,
  })
  const historyQuery = useCashups({ branchId: activeBranchId || undefined, limit: 15 })
  const closeCashup = useCloseCashup()

  const preview = previewQuery.data
  const countedKobo = toKobo(countedNaira)
  const diffKobo = preview ? countedKobo - preview.expectedAmount : 0

  const handleCloseDay = async () => {
    if (!countedNaira) return toast.error("Enter physical counted cash amount")
    try {
      await closeCashup.mutateAsync({
        branchId: activeBranchId || undefined,
        accountId: accountId || undefined,
        date,
        countedAmount: countedKobo,
        notes: notes.trim() || undefined,
        postAdjustment,
      })
      toast.success("End-of-day cash reconciliation saved")
      setCountedNaira("")
      setNotes("")
      previewQuery.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not close cash-up")
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Reconcile Register Cash
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select
            label="Cash Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
            placeholder="Default Cash Drawer"
          />
        </div>

        {preview && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
            <div className="flex justify-between">
              <span className="text-slate-500">Opening Balance</span>
              <span className="font-medium">{formatMoney(preview.openingBalance)}</span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>Cash In Today</span>
              <span>+{formatMoney(preview.cashIn)}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Cash Out Today</span>
              <span>-{formatMoney(preview.cashOut)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold dark:border-slate-700">
              <span>Expected Drawer Cash</span>
              <span>{formatMoney(preview.expectedAmount)}</span>
            </div>
          </div>
        )}

        {preview?.alreadyClosed ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Register already closed for {preview.date} (Counted:{" "}
              {formatMoney(preview.alreadyClosed.countedAmount)})
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              label="Physical Counted Cash (₦)"
              type="number"
              placeholder="0.00"
              value={countedNaira}
              onChange={(e) => setCountedNaira(e.target.value)}
            />
            {countedNaira && preview && (
              <p
                className={`text-xs font-semibold ${
                  diffKobo === 0
                    ? "text-emerald-600"
                    : diffKobo > 0
                      ? "text-blue-600"
                      : "text-rose-600"
                }`}
              >
                Variance: {diffKobo >= 0 ? "+" : ""}
                {formatMoney(diffKobo)}
              </p>
            )}
            <Input
              label="Notes (Optional)"
              placeholder="Explain any shortage or overage"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={postAdjustment}
                onChange={(e) => setPostAdjustment(e.target.checked)}
                className="rounded border-slate-300"
              />
              Post variance adjustment to account balance automatically
            </label>
            <Button className="w-full" onClick={handleCloseDay} disabled={closeCashup.isPending}>
              <Lock className="h-4 w-4" />
              {closeCashup.isPending ? "Closing..." : "Close Day & Save Cash-Up"}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Past Reconciliations
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-[11px] uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 px-3">Account</th>
                <th className="py-2 px-3 text-right">Expected</th>
                <th className="py-2 px-3 text-right">Counted</th>
                <th className="py-2 pl-3 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(historyQuery.data?.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="py-2.5 pr-3 font-medium">{formatDate(row.reconDate)}</td>
                  <td className="py-2.5 px-3 text-slate-500">{row.accountName}</td>
                  <td className="py-2.5 px-3 text-right">{formatMoney(row.expectedAmount)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">{formatMoney(row.countedAmount)}</td>
                  <td
                    className={`py-2.5 pl-3 text-right font-semibold ${
                      row.difference < 0
                        ? "text-rose-600"
                        : row.difference > 0
                          ? "text-blue-600"
                          : "text-emerald-600"
                    }`}
                  >
                    {formatMoney(row.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function CommissionsPanel() {
  const { activeBranchId } = useAuth()
  const [from, setFrom] = useState(startOfMonthIso())
  const [to, setTo] = useState(todayIso())
  const commQuery = useCommissions({
    from,
    to,
    branchId: activeBranchId || undefined,
  })
  const sellers = commQuery.data?.sellers ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <DateRangeFilter from={from} to={to} onChange={({ from: f, to: t }) => { setFrom(f); setTo(t) }} />
        <div className="text-right">
          <p className="text-[11px] uppercase text-slate-500">Total Commission Earned</p>
          <p className="text-base font-bold text-emerald-600">
            {formatMoney(commQuery.data?.totalCommission ?? 0)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Salesperson</th>
              <th className="px-4 py-3 text-right">Sales Count</th>
              <th className="px-4 py-3 text-right">Gross Sales</th>
              <th className="px-4 py-3 text-right">Returned</th>
              <th className="px-4 py-3 text-right">Net Sales</th>
              <th className="px-4 py-3 text-right">Commission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sellers.map((s) => (
              <tr key={s.soldById}>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{s.soldByName}</td>
                <td className="px-4 py-3 text-right">{s.salesCount}</td>
                <td className="px-4 py-3 text-right">{formatMoney(s.totalSales)}</td>
                <td className="px-4 py-3 text-right text-rose-600">{formatMoney(s.returned)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(s.netSales)}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(s.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
