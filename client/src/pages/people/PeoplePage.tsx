import { useState } from "react"
import { Check, Edit2, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useAttendance,
  useDeleteEmployee,
  useEmployees,
  useLeaveRequests,
  useLoans,
  useMarkAttendance,
  useReviewLeave,
} from "@/hooks/useEmployees"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { formatBps, formatMoney } from "@/lib/money"
import { formatDate, todayIso } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TableStatus } from "@/components/shared/TableStatus"
import { EmptyState } from "@/components/shared/EmptyState"
import { SearchInput } from "@/components/shared/SearchInput"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { EmployeeEditorModal, LeaveAndLoanModals } from "@/components/people/EmployeeModal"
import type { Employee, StaffLoan } from "@/types/employee.types"

/** "08:42" in the viewer's local time, or a dash when there is no time. */
const clockTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"

export default function PeoplePage() {
  const { can, activeBranchId } = useAuth()
  const [requestedTab, setTab] = useState<"employees" | "attendance" | "leave" | "loans">("employees")

  // Each tab calls an API with its own permission. Offer only the tabs this user may open (others would 403).
  const tabAccess = {
    employees: can("employee.read"),
    attendance: can("employee.read") || can("attendance.manage"),
    leave: can("leave.request") || can("leave.manage") || can("employee.read"),
    loans: can("loan.manage") || can("payroll.read"),
  } as const
  const visibleTabs = ([["employees", "Staff Directory"], ["attendance", "Attendance Register"], ["leave", "Leave Requests"], ["loans", "Loans & Advances"]] as const).filter(([k]) => tabAccess[k])
  const tab = visibleTabs.some(([k]) => k === requestedTab) ? requestedTab : (visibleTabs[0]?.[0] ?? null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [attDate, setAttDate] = useState(todayIso())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [loanOpen, setLoanOpen] = useState(false)
  const [repayTarget, setRepayTarget] = useState<StaffLoan | null>(null)

  const debouncedSearch = useDebouncedSearch(search, 300, () => setPage(1))

  const employeesQuery = useEmployees({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    branchId: activeBranchId || undefined,
  }, tab === "employees" || tab === "attendance")
  const attendanceQuery = useAttendance(
    { from: attDate, to: attDate, branchId: activeBranchId || undefined },
    tab === "attendance"
  )
  const leaveQuery = useLeaveRequests({ page, limit: 20 }, tab === "leave")
  const loansQuery = useLoans({ page, limit: 20 }, tab === "loans")
  const markAttendance = useMarkAttendance()
  const reviewLeave = useReviewLeave()
  const deleteEmployee = useDeleteEmployee()

  return (
    <div className="space-y-4" data-cy="people-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Staff, Attendance & HR
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Employee directory, daily attendance register, leave approvals, and staff loans
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>
            Request Leave
          </Button>
          {can("loan.manage") && (
            <Button variant="outline" size="sm" onClick={() => setLoanOpen(true)}>
              Issue Loan / Advance
            </Button>
          )}
          {can("employee.create") && (
            <Button size="sm" onClick={() => { setEditTarget(null); setEditorOpen(true) }} data-cy="add-employee-btn">
              <Plus className="h-4 w-4" /> New Staff
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {visibleTabs.map(([k, label]) => (
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

      {tab === null && (
        <EmptyState
          title="Nothing to manage here"
          message="Your role doesn't include staff records. You can clock in and out, and see your own details, from your Profile page."
        />
      )}

      {tab === "employees" && (
        <div className="space-y-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search staff name, code, phone..." />
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-4 py-3">Job Title</th>
                  <th className="px-4 py-3">Phone</th>
                  {can("employee.salary.view") && <th className="px-4 py-3 text-right">Salary</th>}
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <TableStatus loading={employeesQuery.isLoading} error={employeesQuery.isError} empty={(employeesQuery.data?.data ?? []).length === 0} cols={8} />
                {(employeesQuery.data?.data ?? []).map((emp) => (
                  <tr key={emp.id}>
                    <td className="px-4 py-3 font-mono text-slate-500">{emp.code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{emp.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{emp.jobTitle || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{emp.phone || "—"}</td>
                    {can("employee.salary.view") && (
                      <td className="px-4 py-3 text-right font-medium">
                        {emp.salary !== undefined ? formatMoney(emp.salary) : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      {emp.commissionRateBps ? formatBps(emp.commissionRateBps) : "Default"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {can("employee.update") && (
                          <Button variant="ghost" size="icon" onClick={() => { setEditTarget(emp); setEditorOpen(true) }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {can("employee.delete") && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(emp)} className="text-rose-600">
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
          <Pagination meta={employeesQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-xs font-medium">Attendance Date</span>
            <input
              type="date"
              value={attDate}
              onChange={(e) => setAttDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-4 py-3">Recorded Status</th>
                  <th className="px-4 py-3">Clock In</th>
                  <th className="px-4 py-3">Clock Out</th>
                  <th className="px-4 py-3 text-right">Quick Mark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <TableStatus loading={employeesQuery.isLoading} error={employeesQuery.isError} empty={(employeesQuery.data?.data ?? []).length === 0} cols={5} />
                {(employeesQuery.data?.data ?? []).map((emp) => {
                  const rec = (attendanceQuery.data?.data ?? []).find((a) => a.employeeId === emp.id)
                  return (
                    <tr key={emp.id}>
                      <td className="px-4 py-3 font-medium">{emp.fullName}</td>
                      <td className="px-4 py-3">
                        {rec ? <StatusBadge status={rec.status} /> : <span className="text-slate-400">Unmarked</span>}
                        {rec && rec.minutesLate > 0 && <span className="ml-2 text-[11px] text-amber-600">{rec.minutesLate}m late</span>}
                        {rec && rec.minutesEarly > 0 && <span className="ml-2 text-[11px] text-rose-600">Left {rec.minutesEarly}m early</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{clockTime(rec?.clockInAt)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{clockTime(rec?.clockOutAt)}</td>
                      <td className="px-4 py-3 text-right">
                        {can("attendance.manage") && (
                          <div className="flex justify-end gap-1">
                            {(["present", "late", "absent", "off"] as const).map((st) => (
                              <Button
                                key={st}
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  markAttendance.mutate({
                                    date: attDate,
                                    entries: [{ employeeId: emp.id, status: st }],
                                  })
                                }
                              >
                                {st}
                              </Button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "leave" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <TableStatus loading={leaveQuery.isLoading} error={leaveQuery.isError} empty={(leaveQuery.data?.data ?? []).length === 0} cols={5} />
              {(leaveQuery.data?.data ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-semibold">{l.employeeName}</td>
                  <td className="px-4 py-3 uppercase text-slate-500">{l.type}</td>
                  <td className="px-4 py-3">{formatDate(l.startDate)} – {formatDate(l.endDate)} ({l.days}d)</td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {l.status === "pending" && can("attendance.manage") && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => reviewLeave.mutate({ id: l.id, decision: "approved" })} className="text-emerald-600">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => reviewLeave.mutate({ id: l.id, decision: "rejected" })} className="text-rose-600">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "loans" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3 text-right">Principal</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <TableStatus loading={loansQuery.isLoading} error={loansQuery.isError} empty={(loansQuery.data?.data ?? []).length === 0} cols={6} />
              {(loansQuery.data?.data ?? []).map((ln) => (
                <tr key={ln.id}>
                  <td className="px-4 py-3 font-mono">{ln.code}</td>
                  <td className="px-4 py-3 font-semibold">{ln.employeeName}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(ln.principal)}</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600">{formatMoney(ln.outstanding)}</td>
                  <td className="px-4 py-3"><StatusBadge status={ln.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {ln.status === "active" && can("loan.manage") && (
                      <Button variant="outline" size="sm" onClick={() => setRepayTarget(ln)}>Repay</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EmployeeEditorModal open={editorOpen} employee={editTarget} onClose={() => setEditorOpen(false)} />
      <LeaveAndLoanModals
        leaveOpen={leaveOpen}
        onCloseLeave={() => setLeaveOpen(false)}
        loanOpen={loanOpen}
        onCloseLoan={() => setLoanOpen(false)}
        repayTarget={repayTarget}
        onCloseRepay={() => setRepayTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteEmployee.mutateAsync(deleteTarget.id)
          toast.success("Staff record moved to trash")
          setDeleteTarget(null)
        }}
        title="Delete Staff Member"
        description={`Move ${deleteTarget?.fullName} to trash?`}
        confirmLabel="Delete"
        loading={deleteEmployee.isPending}
      />
    </div>
  )
}
