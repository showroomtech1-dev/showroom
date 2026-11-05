export interface EmployeeDTO {
  id: string;
  code: string;
  branchId: string;
  branchName: string;
  userId: string | null;
  userEmail: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  photoUrl: string | null;
  photoPublicId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  jobTitle: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  payFrequency: string;
  salary?: number;
  commissionRateBps: number | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  nextOfKinRelationship: string | null;
  nextOfKinAddress: string | null;
  guarantorName: string | null;
  guarantorPhone: string | null;
  guarantorAddress: string | null;
  guarantorRelationship: string | null;
  guarantorOccupation: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface EmployeeDocumentDTO {
  id: string;
  name: string;
  category: string | null;
  url: string;
  publicId: string;
  mimeType: string | null;
  uploadedByName: string | null;
  createdAt: Date;
}

export interface AttendanceDTO {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  attendanceDate: string;
  status: string;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  minutesLate: number;
  minutesEarly: number;
  notes: string | null;
  source: string;
  recordedByName: string | null;
}

export interface AttendanceSummaryDTO {
  employeeId: string;
  employeeName: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  halfDay: number;
  off: number;
  minutesLate: number;
}

export interface LeaveRequestDTO {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  requestedByName: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
}

/** What payroll needs to know about an employee. */
export interface PayrollEmployeeRow {
  id: string;
  code: string;
  fullName: string;
  userId: string | null;
  branchId: string;
  salary: number;
  payFrequency: string;
  jobTitle: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
}
