// Attendance (self clock-in/out or manager marking) and leave management.
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import type { Actor } from "../../../shared/types/actor";
import { daysBetweenInclusive, eachDate, minutesAfter, resolveRange, todayIn } from "../../../shared/utils/dates";
import { AuditService } from "../../audit/services/audit.service";
import { SettingsService } from "../../organization/services/settings.service";
import type { AttendanceDTO, LeaveRequestDTO } from "../dto/employee.dto";
import { AttendanceRepository } from "../repositories/attendance.repository";
import { EmployeeRepository } from "../repositories/employee.repository";
import type { CreateLeaveInput, ListAttendanceQuery, ListLeaveQuery, MarkAttendanceInput } from "../validators/employee.schema";

export class AttendanceService {
  static Instance = new AttendanceService();
  private constructor(
    private readonly repo = AttendanceRepository.Instance,
    private readonly employees = EmployeeRepository.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private async self(actor: Actor) {
    const employee = await this.employees.findByUserId(actor.organizationId, actor.id);
    if (!employee) throw AppError.badRequest("Your login is not linked to an employee profile. Ask a manager to link it.");
    if (employee.status !== "active") throw AppError.forbidden("Your employee profile is not active");
    return employee;
  }

  async clockIn(actor: Actor, notes?: string | null): Promise<AttendanceDTO> {
    assertPermission(actor, "attendance.clock");
    const employee = await this.self(actor);
    const settings = await this.settings.get(actor.organizationId);
    const now = new Date();
    const date = todayIn(settings.timezone);
    const existing = await this.repo.findForDay(employee.id, date);
    if (existing?.clockInAt) throw AppError.conflict("You have already clocked in today");
    const late = Math.max(0, minutesAfter(settings.workStartTime, now, settings.timezone));
    const isLate = late > settings.lateGraceMinutes;
    await this.repo.upsert({
      organizationId: actor.organizationId,
      employeeId: employee.id,
      branchId: employee.branchId,
      attendanceDate: date,
      status: isLate ? "late" : "present",
      clockInAt: now,
      clockOutAt: null,
      minutesLate: isLate ? late : 0,
      notes: notes ?? null,
      source: "clock",
      recordedById: actor.id,
    });
    return (await this.repo.findForDay(employee.id, date)) as AttendanceDTO;
  }

  async clockOut(actor: Actor): Promise<AttendanceDTO> {
    assertPermission(actor, "attendance.clock");
    const employee = await this.self(actor);
    const { timezone, workEndTime, lateGraceMinutes } = await this.settings.get(actor.organizationId);
    const now = new Date();
    const date = todayIn(timezone);
    // Leaving before closing time (beyond the grace period) is recorded as an early leave.
    const early = Math.max(0, -minutesAfter(workEndTime, now, timezone));
    const minutesEarly = early > lateGraceMinutes ? early : 0;
    if (!(await this.repo.clockOut(employee.id, date, now, minutesEarly))) {
      throw AppError.badRequest("Clock in first (or you have already clocked out today)");
    }
    return (await this.repo.findForDay(employee.id, date)) as AttendanceDTO;
  }

  async today(actor: Actor): Promise<AttendanceDTO | null> {
    const employee = await this.self(actor);
    const { timezone } = await this.settings.get(actor.organizationId);
    return this.repo.findForDay(employee.id, todayIn(timezone));
  }

  /** Manager marks (or corrects) attendance for one day, for one or many employees. */
  async mark(actor: Actor, data: MarkAttendanceInput): Promise<{ saved: number }> {
    assertPermission(actor, "attendance.manage");
    await inTransaction(async (tx) => {
      for (const entry of data.entries) {
        const employee = await this.employees.findById(actor.organizationId, entry.employeeId, tx);
        if (!employee) throw AppError.badRequest("An employee was not found");
        readBranchScope(actor, employee.branchId);
        await this.repo.upsert(
          {
            organizationId: actor.organizationId,
            employeeId: employee.id,
            branchId: employee.branchId,
            attendanceDate: data.date,
            status: entry.status,
            clockInAt: entry.clockInAt ? new Date(entry.clockInAt) : null,
            clockOutAt: entry.clockOutAt ? new Date(entry.clockOutAt) : null,
            minutesLate: entry.status === "late" ? (entry.minutesLate ?? 0) : 0,
            notes: entry.notes ?? null,
            source: "manual",
            recordedById: actor.id,
          },
          tx
        );
      }
      await this.audit.log(actor, { action: "update", entityType: "attendance", summary: `Marked attendance for ${data.entries.length} employee(s) on ${data.date}` }, tx);
    });
    return { saved: data.entries.length };
  }

  async list(actor: Actor, query: ListAttendanceQuery) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const { from, to } = resolveRange(timezone, query.from, query.to);
    return this.repo.list(actor.organizationId, { ...query, from, to, branchId: readBranchScope(actor, query.branchId) });
  }

  async summary(actor: Actor, query: { branchId?: string; from?: string; to?: string }) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const { from, to } = resolveRange(timezone, query.from, query.to);
    return { from, to, employees: await this.repo.summary(actor.organizationId, from, to, readBranchScope(actor, query.branchId)) };
  }

  // ── Leave ──────────────────────────────────────────────────────────────────
  async listLeave(actor: Actor, query: ListLeaveQuery) {
    if (!can(actor, "leave.manage") && !can(actor, "employee.read")) {
      const me = await this.self(actor);
      return this.repo.listLeave(actor.organizationId, { ...query, employeeId: me.id, branchId: null });
    }
    return this.repo.listLeave(actor.organizationId, { ...query, branchId: readBranchScope(actor, query.branchId) });
  }

  async requestLeave(actor: Actor, data: CreateLeaveInput): Promise<LeaveRequestDTO> {
    const forSomeoneElse = Boolean(data.employeeId);
    if (forSomeoneElse) assertPermission(actor, "leave.manage");
    else assertPermission(actor, "leave.request");
    const employee = forSomeoneElse ? await this.employees.findById(actor.organizationId, data.employeeId as string) : await this.self(actor);
    if (!employee) throw AppError.badRequest("Employee not found");
    if (await this.repo.overlappingLeave(employee.id, data.startDate, data.endDate)) throw AppError.conflict("There is already leave booked for these dates");
    const id = await this.repo.createLeave({
      organizationId: actor.organizationId,
      employeeId: employee.id,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      days: daysBetweenInclusive(data.startDate, data.endDate),
      reason: data.reason ?? null,
      status: "pending",
      requestedById: actor.id,
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
    });
    return (await this.repo.findLeave(actor.organizationId, id)) as LeaveRequestDTO;
  }

  /** Approving leave marks every day of it as "leave" on the attendance register. */
  async reviewLeave(actor: Actor, id: string, decision: "approved" | "rejected", note?: string | null): Promise<LeaveRequestDTO> {
    assertPermission(actor, "leave.manage");
    await inTransaction(async (tx) => {
      const leave = await this.repo.findLeave(actor.organizationId, id, tx);
      if (!leave) throw AppError.notFound("Leave request not found");
      readBranchScope(actor, leave.branchId);
      if (leave.status !== "pending") throw AppError.badRequest(`This request is already ${leave.status}`);
      await this.repo.updateLeave(id, { status: decision, reviewedById: actor.id, reviewedAt: new Date(), reviewNote: note ?? null }, tx);
      if (decision === "approved") {
        for (const date of eachDate(leave.startDate, leave.endDate)) {
          await this.repo.upsert(
            { organizationId: actor.organizationId, employeeId: leave.employeeId, branchId: leave.branchId, attendanceDate: date, status: "leave", clockInAt: null, clockOutAt: null, minutesLate: 0, notes: `${leave.type} leave`, source: "manual", recordedById: actor.id },
            tx
          );
        }
      }
      await this.audit.log(actor, { action: decision === "approved" ? "approve" : "cancel", entityType: "leave_request", entityId: id, summary: `${decision === "approved" ? "Approved" : "Rejected"} ${leave.days}-day ${leave.type} leave for ${leave.employeeName}` }, tx);
    });
    domainEvents.emit("leave.reviewed", { organizationId: actor.organizationId, leaveId: id });
    return (await this.repo.findLeave(actor.organizationId, id)) as LeaveRequestDTO;
  }

  async cancelLeave(actor: Actor, id: string): Promise<LeaveRequestDTO> {
    const leave = await this.repo.findLeave(actor.organizationId, id);
    if (!leave) throw AppError.notFound("Leave request not found");
    if (!can(actor, "leave.manage")) {
      const me = await this.self(actor);
      if (me.id !== leave.employeeId) throw AppError.forbidden("You can only cancel your own leave");
      if (leave.status !== "pending") throw AppError.badRequest("Only pending requests can be cancelled — ask a manager");
    }
    if (leave.status === "cancelled" || leave.status === "rejected") throw AppError.badRequest(`This request is already ${leave.status}`);
    await inTransaction(async (tx) => {
      await this.repo.updateLeave(id, { status: "cancelled" }, tx);
      await this.audit.log(actor, { action: "cancel", entityType: "leave_request", entityId: id, summary: `Cancelled leave for ${leave.employeeName}` }, tx);
    });
    return (await this.repo.findLeave(actor.organizationId, id)) as LeaveRequestDTO;
  }
}
