// One salary run (a month or a week). Lifecycle: draft → approved → paid (or cancelled).
import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  timestampColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface PayrollRun {
  id: string;
  organizationId: string;
  branchId: string | null;
  code: string;
  frequency: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalPaid: number;
  notes: string | null;
  createdById: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const PayrollRunEntity = new EntitySchema<PayrollRun>({
  name: "PayrollRun",
  tableName: "payroll_runs",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id", true),
    code: varchar("code", 24),
    frequency: varchar("frequency", 10),
    periodStart: dateColumn("period_start"),
    periodEnd: dateColumn("period_end"),
    payDate: dateColumn("pay_date"),
    status: varchar("status", 12, false, "draft"),
    totalGross: moneyColumn("total_gross"),
    totalDeductions: moneyColumn("total_deductions"),
    totalNet: moneyColumn("total_net"),
    totalPaid: moneyColumn("total_paid"),
    notes: textColumn("notes"),
    createdById: uuidColumn("created_by_id", true),
    approvedById: uuidColumn("approved_by_id", true),
    approvedAt: timestampColumn("approved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [
    { name: "IDX_payroll_runs_org_period", columns: ["organizationId", "periodStart"] },
    { name: "UQ_payroll_runs_org_code", columns: ["organizationId", "code"], unique: true },
  ],
  checks: [{ name: "CHK_payroll_runs_status", expression: `"status" IN ('draft', 'approved', 'paid', 'cancelled')` }],
});
