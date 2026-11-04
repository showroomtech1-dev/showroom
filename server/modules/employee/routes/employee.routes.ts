import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { uploadDocument, uploadImage } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { AttendanceController, EmployeeController, LeaveController } from "../controllers/employee.controller";
import {
  attendanceSummarySchema,
  clockSchema,
  createEmployeeSchema,
  createLeaveSchema,
  employeeDocumentIdSchema,
  employeeIdSchema,
  employeeUploadSchema,
  leaveIdSchema,
  listAttendanceSchema,
  listEmployeesSchema,
  listLeaveSchema,
  markAttendanceSchema,
  reviewLeaveSchema,
  updateEmployeeSchema,
} from "../validators/employee.schema";

/** /api/v1/employees */
export const employeeRouter = Router();
employeeRouter.use(authMiddleware);
employeeRouter.get("/me", requireAny("attendance.clock", "leave.request", "employee.read"), EmployeeController.me);
employeeRouter.get("/", requirePermission("employee.read"), validate(listEmployeesSchema), EmployeeController.list);
employeeRouter.get("/:id", requirePermission("employee.read"), validate(employeeIdSchema), EmployeeController.get);
employeeRouter.post("/", requirePermission("employee.manage"), validate(createEmployeeSchema), EmployeeController.create);
employeeRouter.patch("/:id", requirePermission("employee.manage"), validate(updateEmployeeSchema), EmployeeController.update);
employeeRouter.delete("/:id", requirePermission("employee.manage"), validate(employeeIdSchema), EmployeeController.remove);
employeeRouter.post("/:id/photo", requirePermission("employee.manage"), uploadImage("photo"), validate(employeeUploadSchema), EmployeeController.uploadPhoto);
employeeRouter.post("/:id/documents", requirePermission("employee.manage"), uploadDocument("document"), validate(employeeUploadSchema), EmployeeController.addDocument);
employeeRouter.delete("/:id/documents/:documentId", requirePermission("employee.manage"), validate(employeeDocumentIdSchema), EmployeeController.removeDocument);

/** /api/v1/attendance */
export const attendanceRouter = Router();
attendanceRouter.use(authMiddleware);
attendanceRouter.post("/clock-in", requirePermission("attendance.clock"), validate(clockSchema), AttendanceController.clockIn);
attendanceRouter.post("/clock-out", requirePermission("attendance.clock"), validate(clockSchema), AttendanceController.clockOut);
attendanceRouter.get("/today", requirePermission("attendance.clock"), AttendanceController.today);
attendanceRouter.post("/mark", requirePermission("attendance.manage"), validate(markAttendanceSchema), AttendanceController.mark);
attendanceRouter.get("/summary", requireAny("employee.read", "attendance.manage", "payroll.read"), validate(attendanceSummarySchema), AttendanceController.summary);
attendanceRouter.get("/", requireAny("employee.read", "attendance.manage"), validate(listAttendanceSchema), AttendanceController.list);

/** /api/v1/leave */
export const leaveRouter = Router();
leaveRouter.use(authMiddleware);
leaveRouter.get("/", requireAny("leave.request", "leave.manage", "employee.read"), validate(listLeaveSchema), LeaveController.list);
leaveRouter.post("/", requireAny("leave.request", "leave.manage"), validate(createLeaveSchema), LeaveController.create);
leaveRouter.post("/:id/review", requirePermission("leave.manage"), validate(reviewLeaveSchema), LeaveController.review);
leaveRouter.post("/:id/cancel", requireAny("leave.request", "leave.manage"), validate(leaveIdSchema), LeaveController.cancel);
