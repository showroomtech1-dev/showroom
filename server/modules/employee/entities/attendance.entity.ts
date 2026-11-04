import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  intColumn,
  manyToOne,
  primaryId,
  textColumn,
  timestampColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Attendance {
  id: string;
  organizationId: string;
  employeeId: string;
  branchId: string;
  attendanceDate: string;
  status: string;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  minutesLate: number;
  notes: string | null;
  /** "clock" (self clock-in) or "manual" (marked by a manager). */
  source: string;
  recordedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee?: { id: string };
}

export const AttendanceEntity = new EntitySchema<Attendance>({
  name: "Attendance",
  tableName: "attendance",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    employeeId: uuidColumn("employee_id"),
    branchId: uuidColumn("branch_id"),
    attendanceDate: dateColumn("attendance_date"),
    status: varchar("status", 10),
    clockInAt: timestampColumn("clock_in_at"),
    clockOutAt: timestampColumn("clock_out_at"),
    minutesLate: intColumn("minutes_late", 0),
    notes: textColumn("notes"),
    source: varchar("source", 10, false, "manual"),
    recordedById: uuidColumn("recorded_by_id", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  relations: { employee: manyToOne("Employee", "employee_id", "CASCADE") },
  indices: [
    { name: "UQ_attendance_employee_date", columns: ["employeeId", "attendanceDate"], unique: true },
    { name: "IDX_attendance_org_date", columns: ["organizationId", "attendanceDate"] },
  ],
});
