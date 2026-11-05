import { useState } from "react"
import { Eye, FileText, Plus } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { usePayrollRuns, usePayslips } from "@/hooks/usePayroll"
import { PayrollEndpoints } from "@/endpoints/payroll.endpoints"
import { formatMoney } from "@/lib/money"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TableStatus } from "@/components/shared/TableStatus"
import { EmailPayslipButton } from "@/components/payroll/EmailPayslipButton"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import { PayrollRunDetailModal, PreparePayrollModal } from "@/components/payroll/PayrollRunModal"

export default function PayrollPage() {
  const { can, activeBranchId } = useAuth()
  const [tab, setTab] = useState<"runs" | "payslips">("runs")
  const [page, setPage] = useState(1)
  const [prepareOpen, setPrepareOpen] = useState(false)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)

  const runsQuery = usePayrollRuns({
    page,
    limit: 20,
    branchId: activeBranchId || undefined,
  })
  const payslipsQuery = usePayslips({ page, limit: 20 })

  return (
    <div className="space-y-4" data-cy="payroll-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Payroll & Payslips
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Automated salary, commission, attendance, and loan deduction calculations
          </p>
        </div>
        {can("payroll.manage") && (
          <Button size="sm" onClick={() => setPrepareOpen(true)} data-cy="prepare-payroll-btn">
            <Plus className="h-4 w-4" /> Prepare Payroll Run
          </Button>
        )}
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            ["runs", "Payroll Runs"],
            ["payslips", "Payslips Archive"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setTab(k)
              setPage(1)
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              tab === k
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "runs" && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Run Code</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Pay Date</th>
                  <th className="px-4 py-3 text-right">Staff</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Deductions</th>
                  <th className="px-4 py-3 text-right">Net Payable</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <TableStatus loading={runsQuery.isLoading} error={runsQuery.isError} empty={(runsQuery.data?.data ?? []).length === 0} cols={9} />
                {(runsQuery.data?.data ?? []).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {r.code}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                    </td>
                    <td className="px-4 py-3">{formatDate(r.payDate)}</td>
                    <td className="px-4 py-3 text-right">{r.employeeCount}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(r.totalGross)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{formatMoney(r.totalDeductions)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(r.totalNet)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setActiveRunId(r.id)}>
                        <Eye className="h-3.5 w-3.5" /> Open Run
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={runsQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      {tab === "payslips" && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Payslip Code</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-right">Net Pay</th>
                  <th className="px-4 py-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <TableStatus loading={payslipsQuery.isLoading} error={payslipsQuery.isError} empty={(payslipsQuery.data?.data ?? []).length === 0} cols={5} />
                {(payslipsQuery.data?.data ?? []).map((ps) => (
                  <tr key={ps.id}>
                    <td className="px-4 py-3 font-mono font-semibold">{ps.code}</td>
                    <td className="px-4 py-3 font-medium">{ps.employeeName}</td>
                    <td className="px-4 py-3 text-slate-500">{ps.snapshot.period}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      {formatMoney(ps.snapshot.netPay)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => PayrollEndpoints.openPayslipPdf(ps.id)}>
                          <FileText className="h-3.5 w-3.5" /> Payslip PDF
                        </Button>
                        <EmailPayslipButton payslipId={ps.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={payslipsQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      <PreparePayrollModal
        open={prepareOpen}
        onClose={() => setPrepareOpen(false)}
        onCreated={(id) => setActiveRunId(id)}
      />
      <PayrollRunDetailModal runId={activeRunId} onClose={() => setActiveRunId(null)} />
    </div>
  )
}
