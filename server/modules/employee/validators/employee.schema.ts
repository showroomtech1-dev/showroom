import { z } from "zod";
import { ATTENDANCE_STATUSES, LEAVE_STATUSES, LEAVE_TYPES, PAY_FREQUENCIES } from "../../../config/constants";
import {
  bps,
  dateOnly,
  dateRangeQuery,
  email,
  emptyObject,
  money,
  optionalText,
  pageQuery,
  phone,
  requiredText,
  uuid,
} from "../../../shared/validation/common";

const employeeFields = {
  branchId: uuid.optional(),
  userId: uuid.optional().nullable(),
  firstName: requiredText(80),
  lastName: requiredText(80),
  phone: phone.optional().nullable(),
  email: email.optional().nullable(),
  address: optionalText(500),
  jobTitle: optionalText(80),
  startDate: dateOnly,
  payFrequency: z.enum(PAY_FREQUENCIES).default("monthly"),
  salary: money,
  commissionRateBps: bps.optional().nullable(),
  bankName: optionalText(120),
  bankAccountNumber: z.string().trim().regex(/^[0-9]{6,20}$/, "Enter digits only").optional().nullable(),
  bankAccountName: optionalText(160),
  nextOfKinName: optionalText(160),
  nextOfKinPhone: phone.optional().nullable(),
  nextOfKinRelationship: optionalText(60),
  nextOfKinAddress: optionalText(500),
  guarantorName: optionalText(160),
  guarantorPhone: phone.optional().nullable(),
  guarantorAddress: optionalText(500),
  guarantorRelationship: optionalText(60),
  guarantorOccupation: optionalText(120),
  notes: optionalText(2000),
};

export const createEmployeeSchema = z.object({ body: z.object(employeeFields) });

export const updateEmployeeSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({ ...employeeFields, status: z.enum(["active", "suspended", "terminated"]), endDate: dateOnly.nullable(), payFrequency: z.enum(PAY_FREQUENCIES) })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const listEmployeesSchema = z.object({
  query: z.object({
    ...pageQuery,
    branchId: uuid.optional(),
    status: z.enum(["active", "suspended", "terminated"]).optional(),
    payFrequency: z.enum(PAY_FREQUENCIES).optional(),
  }),
});

export const employeeIdSchema = z.object({ params: z.object({ id: uuid }) });
export const employeeUploadSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ name: optionalText(120), category: optionalText(40) }).passthrough(),
});
export const employeeDocumentIdSchema = z.object({ params: z.object({ id: uuid, documentId: uuid }) });

// ── Attendance ─────────────────────────────────────────────────────────────
export const clockSchema = z.object({ body: z.object({ notes: optionalText(255) }).optional() });

export const markAttendanceSchema = z.object({
  body: z.object({
    date: dateOnly,
    entries: z
      .array(
        z.object({
          employeeId: uuid,
          status: z.enum(ATTENDANCE_STATUSES),
          clockInAt: z.string().datetime({ offset: true }).optional().nullable(),
          clockOutAt: z.string().datetime({ offset: true }).optional().nullable(),
          minutesLate: z.number().int().min(0).max(1440).optional(),
          notes: optionalText(255),
        })
      )
      .min(1)
      .max(500),
  }),
});

export const listAttendanceSchema = z.object({
  query: z.object({
    page: pageQuery.page,
    limit: z.coerce.number().int().min(1).max(200).default(50),
    employeeId: uuid.optional(),
    branchId: uuid.optional(),
    status: z.enum(ATTENDANCE_STATUSES).optional(),
    ...dateRangeQuery,
  }),
});

export const attendanceSummarySchema = z.object({ query: z.object({ branchId: uuid.optional(), ...dateRangeQuery }) });

// ── Leave ──────────────────────────────────────────────────────────────────
export const createLeaveSchema = z.object({
  body: z
    .object({
      /** Leave out to request leave for yourself. */
      employeeId: uuid.optional(),
      type: z.enum(LEAVE_TYPES),
      startDate: dateOnly,
      endDate: dateOnly,
      reason: optionalText(1000),
    })
    .refine((b) => b.endDate >= b.startDate, { message: "End date must be on or after the start date", path: ["endDate"] }),
});

export const listLeaveSchema = z.object({
  query: z.object({
    page: pageQuery.page,
    limit: pageQuery.limit,
    employeeId: uuid.optional(),
    branchId: uuid.optional(),
    status: z.enum(LEAVE_STATUSES).optional(),
    ...dateRangeQuery,
  }),
});

export const reviewLeaveSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ decision: z.enum(["approved", "rejected"]), note: optionalText(1000) }),
});

export const leaveIdSchema = z.object({ params: z.object({ id: uuid }), body: emptyObject.optional() });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>["body"];
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>["body"];
export type ListEmployeesQuery = z.infer<typeof listEmployeesSchema>["query"];
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>["body"];
export type ListAttendanceQuery = z.infer<typeof listAttendanceSchema>["query"];
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>["body"];
export type ListLeaveQuery = z.infer<typeof listLeaveSchema>["query"];
