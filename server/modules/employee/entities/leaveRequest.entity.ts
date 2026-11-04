import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  intColumn,
  manyToOne,
  primaryId,
  textColumn,
  timestampColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface LeaveRequest {
  id: string;
  organizationId: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  requestedById: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  employee?: { id: string };
}

export const LeaveRequestEntity = new EntitySchema<LeaveRequest>({
  name: "LeaveRequest",
  tableName: "leave_requests",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    employeeId: uuidColumn("employee_id"),
    type: varchar("type", 12),
    startDate: dateColumn("start_date"),
    endDate: dateColumn("end_date"),
    days: intColumn("days", 1),
    reason: textColumn("reason"),
    status: varchar("status", 10, false, "pending"),
    requestedById: uuidColumn("requested_by_id", true),
    reviewedById: uuidColumn("reviewed_by_id", true),
    reviewedAt: timestampColumn("reviewed_at"),
    reviewNote: textColumn("review_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { employee: manyToOne("Employee", "employee_id", "CASCADE") },
  indices: [
    { name: "IDX_leave_requests_org_status", columns: ["organizationId", "status"] },
    { name: "IDX_leave_requests_employee", columns: ["employeeId", "startDate"] },
  ],
  checks: [{ name: "CHK_leave_requests_dates", expression: `"end_date" >= "start_date"` }],
});
