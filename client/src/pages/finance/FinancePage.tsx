import { useState } from "react"
import { ArrowRightLeft, Eye, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useAccountStatement,
  useAccountTransfers,
  useAccounts,
  useCashFlow,
  useCreateTransfer,
  useDeleteTransfer,
  useProfitAndLoss,
  useSaveAccount,
} from "@/hooks/useFinance"
import { formatBps, formatMoney, toKobo } from "@/lib/money"
import { formatDate, startOfMonthIso, todayIso } from "@/lib/utils"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TableStatus } from "@/components/shared/TableStatus"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { StatCard } from "@/components/shared/StatCard"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import type { Account } from "@/types/finance.types"

export default function FinancePage() {
  const { can, activeBranchId } = useAuth()
  const [tab, setTab] = useState<"accounts" | "transfers" | "pnl" | "cashflow">("accounts")
  const [from, setFrom] = useState(startOfMonthIso())
  const [to, setTo] = useState(todayIso())
  const [acctOpen, setAcctOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [stmtTarget, setStmtTarget] = useState<Account | null>(null)

  const [acctName, setAcctName] = useState("")
  const [acctType, setAcctType] = useState<"cash" | "bank" | "pos">("bank")
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [openingNaira, setOpeningNaira] = useState("0")

  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [transferNaira, setTransferNaira] = useState("")

  const accountsQuery = useAccounts({ branchId: activeBranchId || undefined })
  const transfersQuery = useAccountTransfers({ limit: 30 })
  const pnlQuery = useProfitAndLoss({ from, to, branchId: activeBranchId || undefined })
  const cfQuery = useCashFlow({ from, to, branchId: activeBranchId || undefined })
  const stmtQuery = useAccountStatement(stmtTarget?.id ?? "", { from, to })
  const saveAccount = useSaveAccount()
  const createTransfer = useCreateTransfer()
  const deleteTransfer = useDeleteTransfer()

  const accounts = accountsQuery.data ?? []
  const totalLiquidity = accounts.reduce((s, a) => s + a.balance, 0)

  const handleCreateAccount = async () => {
    if (!acctName.trim()) return toast.error("Enter account name")
    try {
      await saveAccount.mutateAsync({
        payload: {
          branchId: activeBranchId || undefined,
          name: acctName.trim(),
          type: acctType,
          bankName: bankName.trim() || undefined,
          accountNumber: accountNumber.trim() || undefined,
          openingBalance: toKobo(openingNaira),
        },
      })
      toast.success("Account created")
      setAcctOpen(false)
      setAcctName("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account")
    }
  }

  const handleTransfer = async () => {
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId || toKobo(transferNaira) <= 0) {
      return toast.error("Select distinct accounts and valid transfer amount")
    }
    try {
      await createTransfer.mutateAsync({
        fromAccountId,
        toAccountId,
        amount: toKobo(transferNaira),
      })
      toast.success("Funds transferred")
      setTransferOpen(false)
      setTransferNaira("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer failed")
    }
  }

  return (
    <div className="space-y-4" data-cy="finance-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Accounts, Treasury & P&L
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cash drawers, bank accounts, inter-account transfers, Profit & Loss, and Cash Flow
          </p>
        </div>
        {can("account.manage") && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="h-4 w-4" /> Transfer Funds
            </Button>
            <Button size="sm" onClick={() => setAcctOpen(true)} data-cy="add-account-btn">
              <Plus className="h-4 w-4" /> New Account
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            ["accounts", "Money Accounts"],
            ["transfers", "Inter-Account Transfers"],
            ["pnl", "Profit & Loss (P&L)"],
            ["cashflow", "Cash Flow Statement"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
              tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "accounts" && (
        <div className="space-y-4">
          <StatCard label="Total Liquid Cash & Bank Balance" value={formatMoney(totalLiquidity)} tone="emerald" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <div key={a.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      {a.type}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setStmtTarget(a)}>
                      <Eye className="h-3.5 w-3.5" /> Statement
                    </Button>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">{a.name}</h3>
                  <p className="text-xs text-slate-500">
                    {a.bankName ? `${a.bankName} • ${a.accountNumber || ""}` : "Showroom Register"}
                  </p>
                </div>
                <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{formatMoney(a.balance)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "transfers" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <TableStatus loading={transfersQuery.isLoading} error={transfersQuery.isError} empty={(transfersQuery.data?.data ?? []).length === 0} cols={6} />
              {(transfersQuery.data?.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-mono font-semibold">{t.code}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(t.transferDate)}</td>
                  <td className="px-4 py-3">{t.fromAccountName}</td>
                  <td className="px-4 py-3">{t.toAccountName}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatMoney(t.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteTransfer.mutate(t.id)} className="text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(tab === "pnl" || tab === "cashflow") && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <DateRangeFilter from={from} to={to} onChange={({ from: f, to: t }) => { setFrom(f); setTo(t) }} />
          </div>

          {tab === "pnl" && pnlQuery.data && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Net Revenue" value={formatMoney(pnlQuery.data.revenue.total)} subtitle={`${pnlQuery.data.revenue.salesCount} sales`} />
              <StatCard label="Cost of Goods Sold" value={formatMoney(pnlQuery.data.costOfGoodsSold)} />
              <StatCard label="Gross Profit" value={formatMoney(pnlQuery.data.grossProfit)} subtitle={`Margin: ${formatBps(pnlQuery.data.grossMarginBps)}`} tone="emerald" />
              <StatCard label="Net Profit" value={formatMoney(pnlQuery.data.netProfit)} subtitle={`Expenses: ${formatMoney(pnlQuery.data.expenses.total)}`} tone={pnlQuery.data.netProfit >= 0 ? "emerald" : "rose"} />
            </div>
          )}

          {tab === "cashflow" && cfQuery.data && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Total Cash Inflows" value={formatMoney(cfQuery.data.totalIn)} tone="emerald" />
              <StatCard label="Total Cash Outflows" value={formatMoney(cfQuery.data.totalOut)} tone="rose" />
              <StatCard label="Net Cash Flow" value={formatMoney(cfQuery.data.netCashFlow)} />
            </div>
          )}
        </div>
      )}

      <Dialog open={acctOpen} onClose={() => setAcctOpen(false)} title="Create Money Account">
        <div className="space-y-3">
          <Input label="Account Name *" value={acctName} onChange={(e) => setAcctName(e.target.value)} data-cy="account-name" />
          <Select label="Type" value={acctType} onChange={(e) => setAcctType(e.target.value as typeof acctType)} options={[{ value: "bank", label: "Bank Account" }, { value: "cash", label: "Cash Drawer" }, { value: "pos", label: "POS Settlement" }]} />
          <div className="grid grid-cols-2 gap-2.5">
            <Input label="Bank Name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <Input label="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </div>
          <Input label="Opening Balance (₦)" type="number" value={openingNaira} onChange={(e) => setOpeningNaira(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAcctOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAccount} disabled={saveAccount.isPending}>Save Account</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={transferOpen} onClose={() => setTransferOpen(false)} title="Inter-Account Transfer">
        <div className="space-y-3">
          <Select label="From Account *" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${formatMoney(a.balance)})` }))} placeholder="Select source..." />
          <Select label="To Account *" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} options={accounts.map((a) => ({ value: a.id, label: a.name }))} placeholder="Select destination..." />
          <Input label="Amount (₦) *" type="number" value={transferNaira} onChange={(e) => setTransferNaira(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={createTransfer.isPending}>Transfer</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={Boolean(stmtTarget)} onClose={() => setStmtTarget(null)} title={stmtTarget ? `${stmtTarget.name} Statement` : "Statement"} maxWidth="max-w-2xl">
        <div className="max-h-80 overflow-y-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800">
              <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <TableStatus loading={stmtQuery.isLoading} error={stmtQuery.isError} empty={(stmtQuery.data?.rows ?? []).length === 0} cols={4} />
              {(stmtQuery.data?.rows ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{formatDate(r.transactionDate)}</td>
                  <td className="px-3 py-2">{r.description}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                    {r.direction === "in" ? "+" : "-"}{formatMoney(r.amount)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold">{formatMoney(r.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialog>
    </div>
  )
}
