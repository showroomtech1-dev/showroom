import { uploadWithFields, wrapCall } from "@/transport/http"
import type {
  AttendanceRecord,
  AttendanceSummary,
  Employee,
  LeaveRequest,
  StaffLoan,
} from "@/types/employee.types"

export const EmployeeEndpoints = {
  list: (params?: Record<string, unknown>) =>
    wrapCall<Employee[]>("GET", "/api/v1/employees", params),

  me: () =>
    wrapCall<Employee | null>("GET", "/api/v1/employees/me"),

  get: (id: string) =>
    wrapCall<Employee>("GET", `/api/v1/employees/${id}`),

  create: (payload: Record<string, unknown>) =>
    wrapCall<Employee>("POST", "/api/v1/employees", payload),

  update: (id: string, payload: Record<string, unknown>) =>
    wrapCall<Employee>("PATCH", `/api/v1/employees/${id}`, payload),

  remove: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/employees/${id}`),

  uploadPhoto: (id: string, file: File) =>
    uploadWithFields<Employee>(`/api/v1/employees/${id}/photo`, file, {}, "photo"),

  addDocument: (id: string, file: File, fields: { name?: string; category?: string } = {}) =>
    uploadWithFields<Employee>(
      `/api/v1/employees/${id}/documents`,
      file,
      fields as Record<string, string>,
      "document"
    ),

  removeDocument: (id: string, documentId: string) =>
    wrapCall<Employee>("DELETE", `/api/v1/employees/${id}/documents/${documentId}`),

  clockIn: (notes?: string) =>
    wrapCall<AttendanceRecord>("POST", "/api/v1/attendance/clock-in", notes ? { notes } : {}),

  clockOut: () =>
    wrapCall<AttendanceRecord>("POST", "/api/v1/attendance/clock-out"),

  todayAttendance: () =>
    wrapCall<AttendanceRecord | null>("GET", "/api/v1/attendance/today"),

  markAttendance: (payload: { date: string; entries: Array<Record<string, unknown>> }) =>
    wrapCall<AttendanceRecord[]>("POST", "/api/v1/attendance/mark", payload as unknown as Record<string, unknown>),

  listAttendance: (params?: Record<string, unknown>) =>
    wrapCall<AttendanceRecord[]>("GET", "/api/v1/attendance", params),

  attendanceSummary: (params?: Record<string, unknown>) =>
    wrapCall<AttendanceSummary[]>("GET", "/api/v1/attendance/summary", params),

  listLeave: (params?: Record<string, unknown>) =>
    wrapCall<LeaveRequest[]>("GET", "/api/v1/leave", params),

  createLeave: (payload: Record<string, unknown>) =>
    wrapCall<LeaveRequest>("POST", "/api/v1/leave", payload),

  reviewLeave: (id: string, decision: "approved" | "rejected", note?: string) =>
    wrapCall<LeaveRequest>("POST", `/api/v1/leave/${id}/review`, { decision, note }),

  cancelLeave: (id: string) =>
    wrapCall<LeaveRequest>("POST", `/api/v1/leave/${id}/cancel`),

  listLoans: (params?: Record<string, unknown>) =>
    wrapCall<StaffLoan[]>("GET", "/api/v1/loans", params),

  getLoan: (id: string) =>
    wrapCall<StaffLoan>("GET", `/api/v1/loans/${id}`),

  createLoan: (payload: Record<string, unknown>) =>
    wrapCall<StaffLoan>("POST", "/api/v1/loans", payload),

  updateLoan: (id: string, payload: Record<string, unknown>) =>
    wrapCall<StaffLoan>("PATCH", `/api/v1/loans/${id}`, payload),

  repayLoan: (id: string, payload: Record<string, unknown>) =>
    wrapCall<StaffLoan>("POST", `/api/v1/loans/${id}/repayments`, payload),

  removeLoan: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/loans/${id}`),
}
