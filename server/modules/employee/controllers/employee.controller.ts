import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { requireFile } from "../../../shared/middleware/upload.middleware";
import { AttendanceService } from "../services/attendance.service";
import { EmployeeService } from "../services/employee.service";
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

export class EmployeeController {
  static list = handle("Employees fetched", async (req) => Paged.of(await EmployeeService.Instance.list(actorOf(req), input(req, listEmployeesSchema).query)));

  static me = handle("Your employee profile", (req) => EmployeeService.Instance.me(actorOf(req)));

  static get = handle("Employee fetched", (req) => EmployeeService.Instance.get(actorOf(req), input(req, employeeIdSchema).params.id));

  static create = handle("Employee added", (req) => EmployeeService.Instance.create(actorOf(req), input(req, createEmployeeSchema).body), 201);

  static update = handle("Employee updated", (req) => {
    const { params, body } = input(req, updateEmployeeSchema);
    return EmployeeService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Employee deleted", (req) => EmployeeService.Instance.remove(actorOf(req), input(req, employeeIdSchema).params.id));

  static uploadPhoto = handle("Photo uploaded", (req) =>
    EmployeeService.Instance.uploadPhoto(actorOf(req), input(req, employeeUploadSchema).params.id, requireFile(req).buffer)
  );

  static addDocument = handle(
    "Document uploaded",
    (req) => {
      const { params, body } = input(req, employeeUploadSchema);
      return EmployeeService.Instance.addDocument(actorOf(req), params.id, requireFile(req), body);
    },
    201
  );

  static removeDocument = handle("Document removed", (req) => {
    const { params } = input(req, employeeDocumentIdSchema);
    return EmployeeService.Instance.removeDocument(actorOf(req), params.id, params.documentId);
  });
}

export class AttendanceController {
  static clockIn = handle("Clocked in", (req) => AttendanceService.Instance.clockIn(actorOf(req), input(req, clockSchema).body?.notes));

  static clockOut = handle("Clocked out", (req) => AttendanceService.Instance.clockOut(actorOf(req)));

  static today = handle("Today's attendance", (req) => AttendanceService.Instance.today(actorOf(req)));

  static mark = handle("Attendance saved", (req) => AttendanceService.Instance.mark(actorOf(req), input(req, markAttendanceSchema).body));

  static list = handle("Attendance fetched", async (req) => Paged.of(await AttendanceService.Instance.list(actorOf(req), input(req, listAttendanceSchema).query)));

  static summary = handle("Attendance summary fetched", (req) => AttendanceService.Instance.summary(actorOf(req), input(req, attendanceSummarySchema).query));
}

export class LeaveController {
  static list = handle("Leave requests fetched", async (req) => Paged.of(await AttendanceService.Instance.listLeave(actorOf(req), input(req, listLeaveSchema).query)));

  static create = handle("Leave requested", (req) => AttendanceService.Instance.requestLeave(actorOf(req), input(req, createLeaveSchema).body), 201);

  static review = handle("Leave request reviewed", (req) => {
    const { params, body } = input(req, reviewLeaveSchema);
    return AttendanceService.Instance.reviewLeave(actorOf(req), params.id, body.decision, body.note);
  });

  static cancel = handle("Leave cancelled", (req) => AttendanceService.Instance.cancelLeave(actorOf(req), input(req, leaveIdSchema).params.id));
}
