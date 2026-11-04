// Staff loan or salary advance. Repaid through payroll deductions (installmentAmount per run)
// or manual repayments.
import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Loan {
  id: string;
  organizationId: string;
  employeeId: string;
  code: string;
  type: string;
  principal: number;
  issueDate: string;
  installmentAmount: number;
  amountRepaid: number;
  status: string;
  method: string;
  accountId: string;
  reference: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  employee?: { id: string };
}

export const LoanEntity = new EntitySchema<Loan>({
  name: "Loan",
  tableName: "loans",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    employeeId: uuidColumn("employee_id"),
    code: varchar("code", 24),
    type: varchar("type", 10),
    principal: moneyColumn("principal"),
    issueDate: dateColumn("issue_date"),
    installmentAmount: moneyColumn("installment_amount"),
    amountRepaid: moneyColumn("amount_repaid"),
    status: varchar("status", 12, false, "active"),
    method: varchar("method", 10),
    accountId: uuidColumn("account_id"),
    reference: varchar("reference", 120, true),
    notes: textColumn("notes"),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    employee: manyToOne("Employee", "employee_id"),
  },
  indices: [
    { name: "IDX_loans_org_employee_status", columns: ["organizationId", "employeeId", "status"] },
    { name: "UQ_loans_org_code", columns: ["organizationId", "code"], unique: true },
  ],
  checks: [
    { name: "CHK_loans_principal", expression: `"principal" > 0` },
    { name: "CHK_loans_repaid", expression: `"amount_repaid" >= 0 AND "amount_repaid" <= "principal"` },
  ],
});
