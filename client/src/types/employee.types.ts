export interface Employee {
  id: string
  code: string
  branchId: string
  branchName: string
  userId: string | null
  userEmail: string | null
  firstName: string
  lastName: string
  fullName: string
  photoUrl: string | null
  photoPublicId: string | null
  phone: string | null
  email: string | null
  address: string | null
  jobTitle: string | null
  startDate: string
  endDate: string | null
  status: "active" | "suspended" | "terminated"
  payFrequency: "monthly" | "weekly"
  salary?: number
  commissionRateBps: number | null
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
  nextOfKinName: string | null
  nextOfKinPhone: string | null
  nextOfKinRelationship: string | null
  nextOfKinAddress: string | null
  guarantorName: string | null
  guarantorPhone: string | null
  guarantorAddress: string | null
  guarantorRelationship: string | null
  guarantorOccupation: string | null
  notes: string | null
  createdAt: string
  documents?: EmployeeDocument[]
}

export interface EmployeeDocument {
  id: string
  name: string
  category: string | null
  url: string
  publicId: string
  mimeType: string | null
  uploadedByName: string | null
  createdAt: string
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  branchId: string
  attendanceDate: string
  status: "present" | "late" | "absent" | "leave" | "half_day" | "off"
  clockInAt: string | null
  clockOutAt: string | null
  minutesLate: number
  notes: string | null
  source: string
  recordedByName: string | null
}

export interface AttendanceSummary {
  employeeId: string
  employeeName: string
  present: number
  late: number
  absent: number
  leave: number
  halfDay: number
  off: number
  minutesLate: number
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  type: "annual" | "sick" | "casual" | "maternity" | "paternity" | "unpaid" | "other"
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: "pending" | "approved" | "rejected" | "cancelled"
  requestedByName: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
}

export interface StaffLoan {
  id: string
  code: string
  employeeId: string
  employeeName: string
  type: "loan" | "advance"
  principal: number
  issueDate: string
  installmentAmount: number
  amountRepaid: number
  outstanding: number
  status: "active" | "settled" | "written_off"
  method: string
  accountId: string
  accountName: string
  reference: string | null
  notes: string | null
  createdByName: string | null
  createdAt: string
  repayments?: Array<{
    id: string
    amount: number
    repaymentDate: string
    source: string
    method: string | null
    payrollItemId: string | null
    createdAt: string
  }>
}
