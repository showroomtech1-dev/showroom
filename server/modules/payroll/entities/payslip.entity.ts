// Issued once an employee's pay for a run is settled. `snapshot` freezes the figures and
// employee details printed on it.
import { EntitySchema } from "typeorm";
import { createdAt, jsonColumn, manyToOne, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface Payslip {
  id: string;
  organizationId: string;
  runId: string;
  payrollItemId: string;
  employeeId: string;
  code: string;
  snapshot: Record<string, unknown>;
  createdAt: Date;
  payrollItem?: { id: string };
}

export const PayslipEntity = new EntitySchema<Payslip>({
  name: "Payslip",
  tableName: "payslips",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    runId: uuidColumn("run_id"),
    payrollItemId: uuidColumn("payroll_item_id"),
    employeeId: uuidColumn("employee_id"),
    code: varchar("code", 30),
    snapshot: jsonColumn("snapshot", false),
    createdAt: createdAt(),
  },
  relations: { payrollItem: manyToOne("PayrollItem", "payroll_item_id", "CASCADE") },
  indices: [
    { name: "UQ_payslips_item", columns: ["payrollItemId"], unique: true },
    { name: "IDX_payslips_employee", columns: ["organizationId", "employeeId"] },
  ],
});
