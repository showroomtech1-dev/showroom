import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useCreateLeave,
  useCreateLoan,
  useEmployees,
  useRepayLoan,
  useSaveEmployee,
} from "@/hooks/useEmployees"
import { useAccounts } from "@/hooks/useFinance"
import { useUserLookup } from "@/hooks/useOrganization"
import { fromBps, fromKobo, toBps, toKobo } from "@/lib/money"
import { todayIso } from "@/lib/utils"
import { NIGERIAN_BANKS } from "@/lib/banks"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Select } from "@/components/ui/select"
import type { Employee, StaffLoan } from "@/types/employee.types"

interface EmployeeEditorModalProps {
  open: boolean
  employee: Employee | null
  onClose: () => void
}

export function EmployeeEditorModal({ open, employee, onClose }: EmployeeEditorModalProps) {
  const { activeBranchId } = useAuth()
  const saveEmployee = useSaveEmployee()
  const userLookup = useUserLookup(open)
  const employeesQuery = useEmployees({ limit: 100 })
  const [userId, setUserId] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [startDate, setStartDate] = useState(todayIso())
  const [payFrequency, setPayFrequency] = useState<"monthly" | "weekly">("monthly")
  const [salaryNaira, setSalaryNaira] = useState("")
  const [commPercent, setCommPercent] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [bankAccountName, setBankAccountName] = useState("")
  const [guarantorName, setGuarantorName] = useState("")
  const [guarantorPhone, setGuarantorPhone] = useState("")

  useEffect(() => {
    autofilled.current = {}
    if (employee) {
      setUserId(employee.userId ?? "")
      setFirstName(employee.firstName)
      setLastName(employee.lastName)
      setPhone(employee.phone ?? "")
      setEmail(employee.email ?? "")
      setJobTitle(employee.jobTitle ?? "")
      setStartDate(employee.startDate.slice(0, 10))
      setPayFrequency(employee.payFrequency)
      setSalaryNaira(employee.salary !== undefined ? String(fromKobo(employee.salary)) : "")
      setCommPercent(employee.commissionRateBps !== null ? String(fromBps(employee.commissionRateBps)) : "")
      setBankName(employee.bankName ?? "")
      setBankAccountNumber(employee.bankAccountNumber ?? "")
      setBankAccountName(employee.bankAccountName ?? "")
      setGuarantorName(employee.guarantorName ?? "")
      setGuarantorPhone(employee.guarantorPhone ?? "")
    } else {
      setUserId("")
      setFirstName("")
      setLastName("")
      setPhone("")
      setEmail("")
      setJobTitle("")
      setStartDate(todayIso())
      setPayFrequency("monthly")
      setSalaryNaira("")
      setCommPercent("")
      setBankName("")
      setBankAccountNumber("")
      setBankAccountName("")
      setGuarantorName("")
      setGuarantorPhone("")
    }
  }, [employee, open])

  // Remembers what we filled in from a login, so picking a different login replaces it
  // but never overwrites something the user typed themselves.
  const autofilled = useRef<Record<string, string>>({})

  const handleLoginChange = (id: string) => {
    setUserId(id)
    const u = (userLookup.data ?? []).find((x) => x.id === id)
    if (!u) return
    const parts = u.name.trim().split(/\s+/)
    const fills: Array<[string, string, string, (v: string) => void]> = [
      ["firstName", firstName, parts[0] ?? "", setFirstName],
      ["lastName", lastName, parts.slice(1).join(" "), setLastName],
      ["email", email, u.email ?? "", setEmail],
      ["phone", phone, u.phone ?? "", setPhone],
      ["jobTitle", jobTitle, u.roleName, setJobTitle],
    ]
    for (const [key, current, next, set] of fills) {
      if (!next) continue
      if (current === "" || current === autofilled.current[key]) {
        set(next)
        autofilled.current[key] = next
      }
    }
  }

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) return toast.error("First and last name are required")
    if (bankAccountNumber && bankAccountNumber.length !== 10) return toast.error("Account number must be 10 digits")
    try {
      await saveEmployee.mutateAsync({
        id: employee?.id,
        payload: {
          branchId: activeBranchId || undefined,
          userId: userId || null,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          jobTitle: jobTitle.trim() || null,
          startDate,
          payFrequency,
          salary: toKobo(salaryNaira),
          commissionRateBps: commPercent ? toBps(commPercent) : null,
          bankName: bankName.trim() || null,
          bankAccountNumber: bankAccountNumber.trim() || null,
          bankAccountName: bankAccountName.trim() || null,
          guarantorName: guarantorName.trim() || null,
          guarantorPhone: guarantorPhone.trim() || null,
        },
      })
      toast.success(employee ? "Employee updated" : "Employee created")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save employee")
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={employee ? "Edit Employee" : "New Staff Member"} maxWidth="max-w-2xl">
      <div className="space-y-4 py-1">
        <Select
          label="Linked Login (optional)"
          value={userId}
          onChange={(e) => handleLoginChange(e.target.value)}
          options={(userLookup.data ?? [])
            // Hide logins already linked to a different employee (the server refuses those anyway).
            .filter((u) => !(employeesQuery.data?.data ?? []).some((e) => e.userId === u.id && e.id !== employee?.id))
            .map((u) => ({ value: u.id, label: `${u.name} — ${u.roleName}` }))}
          placeholder="Not linked to a login"
          hint="Picking a login fills in the name, email, phone and job title below. It also lets this person clock in from their Profile page."
        />

        <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Personal details</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="First Name *" value={firstName} onChange={(e) => setFirstName(e.target.value)} data-cy="emp-first-name" />
            <Input label="Last Name *" value={lastName} onChange={(e) => setLastName(e.target.value)} data-cy="emp-last-name" />
            <PhoneInput label="Phone" value={phone} onChange={setPhone} />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Job Title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pay</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label="Pay Frequency"
              value={payFrequency}
              onChange={(e) => setPayFrequency(e.target.value as "monthly" | "weekly")}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "weekly", label: "Weekly" },
              ]}
            />
            <Input label="Base Salary (₦)" type="number" value={salaryNaira} onChange={(e) => setSalaryNaira(e.target.value)} />
            <Input label="Sales Commission (%)" type="number" step="0.1" value={commPercent} onChange={(e) => setCommPercent(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bank details (for salary payments)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Bank Name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              options={(bankName && !NIGERIAN_BANKS.includes(bankName) ? [bankName, ...NIGERIAN_BANKS] : NIGERIAN_BANKS).map((b) => ({ value: b, label: b }))}
              placeholder="Select bank"
            />
            <Input
              label="Account Number"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit account number"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              error={bankAccountNumber && bankAccountNumber.length !== 10 ? "Account number must be 10 digits" : undefined}
            />
          </div>
          <Input
            label="Account Name"
            placeholder="Name on the account"
            value={bankAccountName}
            onChange={(e) => setBankAccountName(e.target.value)}
          />
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Guarantor</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Guarantor Name" value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} />
            <PhoneInput label="Guarantor Phone" value={guarantorPhone} onChange={setGuarantorPhone} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveEmployee.isPending} data-cy="emp-save">Save Staff</Button>
        </div>
      </div>
    </Dialog>
  )
}

export function LeaveAndLoanModals({
  leaveOpen,
  onCloseLeave,
  loanOpen,
  onCloseLoan,
  repayTarget,
  onCloseRepay,
}: {
  leaveOpen: boolean
  onCloseLeave: () => void
  loanOpen: boolean
  onCloseLoan: () => void
  repayTarget: StaffLoan | null
  onCloseRepay: () => void
}) {
  const employeesQuery = useEmployees({ limit: 100 })
  const accountsQuery = useAccounts()
  const createLeave = useCreateLeave()
  const createLoan = useCreateLoan()
  const repayLoan = useRepayLoan()

  const [empId, setEmpId] = useState("")
  const [leaveType, setLeaveType] = useState("annual")
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState(todayIso())
  const [reason, setReason] = useState("")

  const [loanType, setLoanType] = useState<"loan" | "advance">("advance")
  const [principalNaira, setPrincipalNaira] = useState("")
  const [installmentNaira, setInstallmentNaira] = useState("")
  const [method, setMethod] = useState<"cash" | "transfer" | "pos" | "cheque">("transfer")
  const [accountId, setAccountId] = useState("")
  const [repayNaira, setRepayNaira] = useState("")

  const empOptions = (employeesQuery.data?.data ?? []).map((e) => ({ value: e.id, label: e.fullName }))

  return (
    <>
      <Dialog open={leaveOpen} onClose={onCloseLeave} title="Request Staff Leave">
        <div className="space-y-3">
          <Select label="Employee *" value={empId} onChange={(e) => setEmpId(e.target.value)} options={empOptions} placeholder="Select staff..." />
          <Select
            label="Leave Type"
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            options={[
              { value: "annual", label: "Annual Leave" },
              { value: "sick", label: "Sick Leave" },
              { value: "casual", label: "Casual Leave" },
              { value: "maternity", label: "Maternity" },
              { value: "unpaid", label: "Unpaid" },
            ]}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCloseLeave}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!empId) return toast.error("Select employee")
                await createLeave.mutateAsync({ employeeId: empId, type: leaveType, startDate, endDate, reason })
                toast.success("Leave request submitted")
                onCloseLeave()
              }}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={loanOpen} onClose={onCloseLoan} title="Issue Staff Loan / Salary Advance">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <Select label="Employee *" value={empId} onChange={(e) => setEmpId(e.target.value)} options={empOptions} placeholder="Select staff..." />
            <Select
              label="Facility Type"
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as "loan" | "advance")}
              options={[
                { value: "advance", label: "Salary Advance" },
                { value: "loan", label: "Staff Loan" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Input label="Principal Amount (₦) *" type="number" value={principalNaira} onChange={(e) => setPrincipalNaira(e.target.value)} />
            <Input label="Payroll Installment (₦) *" type="number" value={installmentNaira} onChange={(e) => setInstallmentNaira(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Select
              label="Disbursement Method"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              options={[{ value: "transfer", label: "Transfer" }, { value: "cash", label: "Cash" }]}
            />
            <Select
              label="From Account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              options={(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
              placeholder="Default"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCloseLoan}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!empId || toKobo(principalNaira) <= 0) return toast.error("Enter valid loan details")
                await createLoan.mutateAsync({
                  employeeId: empId,
                  type: loanType,
                  principal: toKobo(principalNaira),
                  installmentAmount: toKobo(installmentNaira) || toKobo(principalNaira),
                  method,
                  accountId: accountId || undefined,
                })
                toast.success("Loan disbursed")
                onCloseLoan()
              }}
            >
              Disburse Funds
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={Boolean(repayTarget)} onClose={onCloseRepay} title={`Direct Loan Repayment — ${repayTarget?.employeeName ?? ""}`}>
        <div className="space-y-3">
          <Input label="Repayment Amount (₦)" type="number" value={repayNaira} onChange={(e) => setRepayNaira(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCloseRepay}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!repayTarget || toKobo(repayNaira) <= 0) return
                await repayLoan.mutateAsync({
                  id: repayTarget.id,
                  payload: { amount: toKobo(repayNaira), method: "cash" },
                })
                toast.success("Loan repayment recorded")
                onCloseRepay()
              }}
            >
              Record Repayment
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
