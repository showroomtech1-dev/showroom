import { useState } from "react"
import { CheckCircle2, CreditCard, FileText, RefreshCw, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useApprovePayrollRun,
  useCancelPayrollRun,
  useCreatePayrollRun,
  usePayPayrollRun,
  usePayrollRun,
  useRecalculatePayrollRun,
  useUpdatePayrollItem,
} from "@/hooks/usePayroll"
import { useAccounts } from "@/hooks/useFinance"
import { PayrollEndpoints } from "@/endpoints/payroll.endpoints"
import { formatMoney, fromKobo, toKobo } from "@/lib/money"
import { formatDate, startOfMonthIso, todayIso } from "@/lib/utils"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/StatusBadge"

interface PreparePayrollModalProps {
  open: boolean
  onClose: () => void
  onCreated: (runId: string) => void
}

export function PreparePayrollModal({ open, onClose, onCreated }: PreparePayrollModalProps) {
  const { activeBranchId } = useAuth()
  const createRun = useCreatePayrollRun()
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly")
  const [periodStart, setPeriodStart] = useState(startOfMonthIso())
  const [periodEnd, setPeriodEnd] = useState(todayIso())
  const [payDate, setPayDate] = useState(todayIso())
  const [notes, setNotes] = useState("")

  const handlePrepare = async () => {
    try {
      const run = await createRun.mutateAsync({
        branchId: activeBranchId || undefined,
        frequency,
        periodStart,
        periodEnd,
        payDate,
        notes: notes.trim() || undefined,
      })
      toast.success(`Payroll run ${run.code} prepared`)
      onClose()
      onCreated(run.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not prepare payroll run")
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Prepare Payroll Run">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Select
            label="Pay Frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as "monthly" | "weekly")}
            options={[
              { value: "monthly", label: "Monthly Payroll" },
              { value: "weekly", label: "Weekly Payroll" },
            ]}
          />
          <Input label="Pay Date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Input label="Period Start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <Input label="Period End" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePrepare} disabled={createRun.isPending} data-cy="prepare-payroll-submit">
            {createRun.isPending ? "Calculating..." : "Generate Draft Payroll"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface PayrollRunDetailModalProps {
  runId: string | null
  onClose: () => void
}

export function PayrollRunDetailModal({ runId, onClose }: PayrollRunDetailModalProps) {
  const { can } = useAuth()
  const runQuery = usePayrollRun(runId ?? "")
  const recalcRun = useRecalculatePayrollRun()
  const approveRun = useApprovePayrollRun()
  const cancelRun = useCancelPayrollRun()
  const payRun = usePayPayrollRun()
  const updateItem = useUpdatePayrollItem()
  const accountsQuery = useAccounts()

  const [payMethod, setPayMethod] = useState<"transfer" | "cash" | "cheque">("transfer")
  const [payAccountId, setPayAccountId] = useState("")
  const [bonusEdits, setBonusEdits] = useState<Record<string, string>>({})

  const run = runQuery.data

  const handleSaveBonus = async (itemId: string, valNaira: string) => {
    if (!run) return
    try {
      await updateItem.mutateAsync({
        runId: run.id,
        itemId,
        payload: { bonus: toKobo(valNaira) },
      })
      toast.success("Payroll item updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update item")
    }
  }

  return (
    <Dialog
      open={Boolean(runId)}
      onClose={onClose}
      title={run ? `Payroll Run ${run.code}` : "Payroll Run Details"}
      description={run ? `Period: ${formatDate(run.periodStart)} – ${formatDate(run.periodEnd)}` : ""}
      maxWidth="max-w-4xl"
    >
      {!run ? (
        <p className="py-8 text-center text-xs text-slate-500">Loading payroll run...</p>
      ) : (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
              <p className="text-slate-500">Gross Earnings</p>
              <p className="mt-0.5 text-sm font-bold">{formatMoney(run.totalGross)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
              <p className="text-slate-500">Total Deductions</p>
              <p className="mt-0.5 text-sm font-bold text-rose-600">{formatMoney(run.totalDeductions)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
              <p className="text-slate-500">Net Payable</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-600">{formatMoney(run.totalNet)}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
              <div>
                <p className="text-slate-500">Status</p>
                <p className="mt-0.5 font-semibold">{run.employeeCount} staff</p>
              </div>
              <StatusBadge status={run.status} />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2">Staff</th>
                  <th className="px-3 py-2 text-right">Basic</th>
                  <th className="px-3 py-2 text-right">Comm</th>
                  <th className="px-3 py-2 text-right">Bonus (₦)</th>
                  <th className="px-3 py-2 text-right">Deductions</th>
                  <th className="px-3 py-2 text-right">Net Pay</th>
                  <th className="px-3 py-2 text-right">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(run.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium">{item.employeeName}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(item.basicSalary)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(item.commission)}</td>
                    <td className="px-3 py-2 text-right">
                      {run.status === "draft" && can("payroll.manage") ? (
                        <input
                          type="number"
                          defaultValue={fromKobo(item.bonus)}
                          onBlur={(e) => {
                            if (bonusEdits[item.id] !== undefined) {
                              handleSaveBonus(item.id, e.target.value)
                            }
                          }}
                          onChange={(e) =>
                            setBonusEdits((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-right dark:border-slate-700 dark:bg-slate-800"
                        />
                      ) : (
                        formatMoney(item.bonus)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-rose-600">{formatMoney(item.totalDeductions)}</td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-600">{formatMoney(item.netPay)}</td>
                    <td className="px-3 py-2 text-right">
                      {item.payslipId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => PayrollEndpoints.openPayslipPdf(item.payslipId!)}
                        >
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {run.status === "approved" && can("payroll.pay") && (
            <div className="flex flex-wrap items-end justify-between gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="flex gap-2">
                <Select
                  label="Payment Method"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                  options={[
                    { value: "transfer", label: "Bank Transfer" },
                    { value: "cash", label: "Cash" },
                    { value: "cheque", label: "Cheque" },
                  ]}
                />
                <Select
                  label="Disbursement Account"
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  options={(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
                  placeholder="Default Account"
                />
              </div>
              <Button
                onClick={async () => {
                  try {
                    await payRun.mutateAsync({
                      id: run.id,
                      payload: { method: payMethod, accountId: payAccountId || undefined },
                    })
                    toast.success("Payroll disbursed and payslips generated")
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to disburse payroll")
                  }
                }}
                disabled={payRun.isPending}
                data-cy="pay-payroll-run-btn"
              >
                <CreditCard className="h-4 w-4" />
                {payRun.isPending ? "Disbursing..." : `Pay All Staff (${formatMoney(run.totalNet - run.totalPaid)})`}
              </Button>
            </div>
          )}

          {run.status === "draft" && (
            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => cancelRun.mutate(run.id)}
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel Run
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => recalcRun.mutate(run.id)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Recalculate
                </Button>
                {can("payroll.approve") && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await approveRun.mutateAsync(run.id)
                      toast.success("Payroll run approved")
                    }}
                    data-cy="approve-payroll-run-btn"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve Run
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}
