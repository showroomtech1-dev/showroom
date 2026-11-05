import { SqlParams } from "../../../infrastructure/database/sql";
import { db, updateReturning, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { num } from "../../../shared/utils/money";
import type { AttendanceDTO, AttendanceSummaryDTO, LeaveRequestDTO } from "../dto/employee.dto";
import type { Attendance } from "../entities/attendance.entity";
import { LeaveRequestEntity, type LeaveRequest } from "../entities/leaveRequest.entity";

const ATTENDANCE = `
  SELECT a.id, a.employee_id AS "employeeId", e.first_name || ' ' || e.last_name AS "employeeName", a.branch_id AS "branchId",
         a.attendance_date AS "attendanceDate", a.status, a.clock_in_at AS "clockInAt", a.clock_out_at AS "clockOutAt",
         a.minutes_late AS "minutesLate", a.minutes_early AS "minutesEarly", a.notes, a.source, u.name AS "recordedByName"
  FROM attendance a
  JOIN employees e ON e.id = a.employee_id
  LEFT JOIN users u ON u.id = a.recorded_by_id`;

const LEAVE = `
  SELECT l.id, l.employee_id AS "employeeId", e.first_name || ' ' || e.last_name AS "employeeName", l.type,
         l.start_date AS "startDate", l.end_date AS "endDate", l.days, l.reason, l.status,
         ru.name AS "requestedByName", vu.name AS "reviewedByName", l.reviewed_at AS "reviewedAt", l.review_note AS "reviewNote",
         l.created_at AS "createdAt"
  FROM leave_requests l
  JOIN employees e ON e.id = l.employee_id
  LEFT JOIN users ru ON ru.id = l.requested_by_id
  LEFT JOIN users vu ON vu.id = l.reviewed_by_id`;

export class AttendanceRepository {
  static Instance = new AttendanceRepository();
  private constructor() {}

  async list(
    organizationId: string,
    f: { page: number; limit: number; employeeId?: string; branchId: string | null; status?: string; from: string; to: string }
  ): Promise<PagedRows<AttendanceDTO>> {
    const p = new SqlParams();
    const where = [`a.organization_id = ${p.add(organizationId)}`, `a.attendance_date BETWEEN ${p.add(f.from)} AND ${p.add(f.to)}`];
    if (f.employeeId) where.push(`a.employee_id = ${p.add(f.employeeId)}`);
    if (f.branchId) where.push(`a.branch_id = ${p.add(f.branchId)}`);
    if (f.status) where.push(`a.status = ${p.add(f.status)}`);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${ATTENDANCE} WHERE ${where.join(" AND ")}) x
       ORDER BY x."attendanceDate" DESC, x."employeeName" LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<AttendanceDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findForDay(employeeId: string, date: string, tx?: Tx): Promise<AttendanceDTO | null> {
    const rows: AttendanceDTO[] = await db(tx).query(`${ATTENDANCE} WHERE a.employee_id = $1 AND a.attendance_date = $2`, [employeeId, date]);
    return rows[0] ?? null;
  }

  /** Insert or replace the day's record for an employee. */
  async upsert(data: Omit<Attendance, "id" | "createdAt" | "updatedAt" | "employee" | "minutesEarly"> & { minutesEarly?: number }, tx?: Tx): Promise<void> {
    await db(tx).query(
      `INSERT INTO attendance (organization_id, employee_id, branch_id, attendance_date, status, clock_in_at, clock_out_at, minutes_late, minutes_early, notes, source, recorded_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $12, $9, $10, $11)
       ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
         status = EXCLUDED.status, clock_in_at = COALESCE(EXCLUDED.clock_in_at, attendance.clock_in_at),
         clock_out_at = COALESCE(EXCLUDED.clock_out_at, attendance.clock_out_at), minutes_late = EXCLUDED.minutes_late, minutes_early = EXCLUDED.minutes_early,
         notes = COALESCE(EXCLUDED.notes, attendance.notes), source = EXCLUDED.source, recorded_by_id = EXCLUDED.recorded_by_id,
         updated_at = now()`,
      [data.organizationId, data.employeeId, data.branchId, data.attendanceDate, data.status, data.clockInAt, data.clockOutAt, data.minutesLate, data.notes, data.source, data.recordedById, data.minutesEarly ?? 0]
    );
  }

  async clockOut(employeeId: string, date: string, at: Date, minutesEarly = 0): Promise<boolean> {
    const rows = await updateReturning<{ id: string }>(
      db(),
      `UPDATE attendance SET clock_out_at = $3, minutes_early = $4, updated_at = now() WHERE employee_id = $1 AND attendance_date = $2 AND clock_out_at IS NULL RETURNING id`,
      [employeeId, date, at, minutesEarly]
    );
    return rows.length > 0;
  }

  async summary(organizationId: string, from: string, to: string, branchId: string | null, employeeIds?: string[], tx?: Tx): Promise<AttendanceSummaryDTO[]> {
    const rows: AttendanceSummaryDTO[] = await db(tx).query(
      `SELECT e.id AS "employeeId", e.first_name || ' ' || e.last_name AS "employeeName",
              COUNT(a.id) FILTER (WHERE a.status = 'present') AS present, COUNT(a.id) FILTER (WHERE a.status = 'late') AS late,
              COUNT(a.id) FILTER (WHERE a.status = 'absent') AS absent, COUNT(a.id) FILTER (WHERE a.status = 'leave') AS leave,
              COUNT(a.id) FILTER (WHERE a.status = 'half_day') AS "halfDay", COUNT(a.id) FILTER (WHERE a.status = 'off') AS off,
              COALESCE(SUM(a.minutes_late), 0) AS "minutesLate"
       FROM employees e
       LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date BETWEEN $2 AND $3
       WHERE e.organization_id = $1 AND e.deleted_at IS NULL AND e.status <> 'terminated'
         AND ($4::uuid IS NULL OR e.branch_id = $4) AND ($5::uuid[] IS NULL OR e.id = ANY($5::uuid[]))
       GROUP BY e.id ORDER BY "employeeName"`,
      [organizationId, from, to, branchId, employeeIds ?? null]
    );
    return rows.map((r) => ({
      ...r,
      present: num(r.present),
      late: num(r.late),
      absent: num(r.absent),
      leave: num(r.leave),
      halfDay: num(r.halfDay),
      off: num(r.off),
      minutesLate: num(r.minutesLate),
    }));
  }

  // ── Leave ──────────────────────────────────────────────────────────────────
  async listLeave(
    organizationId: string,
    f: { page: number; limit: number; employeeId?: string; status?: string; branchId: string | null; from?: string; to?: string }
  ): Promise<PagedRows<LeaveRequestDTO>> {
    const p = new SqlParams();
    const where = [`l.organization_id = ${p.add(organizationId)}`, "l.deleted_at IS NULL"];
    if (f.employeeId) where.push(`l.employee_id = ${p.add(f.employeeId)}`);
    if (f.status) where.push(`l.status = ${p.add(f.status)}`);
    if (f.branchId) where.push(`e.branch_id = ${p.add(f.branchId)}`);
    if (f.from) where.push(`l.end_date >= ${p.add(f.from)}`);
    if (f.to) where.push(`l.start_date <= ${p.add(f.to)}`);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${LEAVE} WHERE ${where.join(" AND ")}) x
       ORDER BY x."startDate" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<LeaveRequestDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findLeave(organizationId: string, id: string, tx?: Tx): Promise<(LeaveRequestDTO & { branchId: string }) | null> {
    const rows = await db(tx).query(
      `SELECT x.*, e2.branch_id AS "branchId" FROM (${LEAVE} WHERE l.organization_id = $1 AND l.id = $2 AND l.deleted_at IS NULL) x
       JOIN employees e2 ON e2.id = x."employeeId"`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async overlappingLeave(employeeId: string, start: string, end: string, exceptId?: string): Promise<boolean> {
    const rows: Array<{ id: string }> = await db().query(
      `SELECT id FROM leave_requests WHERE employee_id = $1 AND deleted_at IS NULL AND status IN ('pending', 'approved')
         AND start_date <= $3 AND end_date >= $2 AND ($4::uuid IS NULL OR id <> $4::uuid) LIMIT 1`,
      [employeeId, start, end, exceptId ?? null]
    );
    return rows.length > 0;
  }

  async createLeave(data: Omit<LeaveRequest, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx?: Tx): Promise<string> {
    const repo = db(tx).getRepository(LeaveRequestEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async updateLeave(id: string, data: Partial<LeaveRequest>, tx: Tx): Promise<void> {
    await tx.getRepository(LeaveRequestEntity).update({ id }, data);
  }
}
