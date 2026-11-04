import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  manyToOne,
  moneyColumn,
  primaryId,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface PayrollPayment {
  id: string;
  organizationId: string;
  runId: string;
  payrollItemId: string;
  employeeId: string;
  amount: number;
  method: string;
  accountId: string;
  paymentDate: string;
  reference: string | null;
  paidById: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  payrollItem?: { id: string };
  account?: { id: string };
}

export const PayrollPaymentEntity = new EntitySchema<PayrollPayment>({
  name: "PayrollPayment",
  tableName: "payroll_payments",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    runId: uuidColumn("run_id"),
    payrollItemId: uuidColumn("payroll_item_id"),
    employeeId: uuidColumn("employee_id"),
    amount: moneyColumn("amount"),
    method: varchar("method", 10),
    accountId: uuidColumn("account_id"),
    paymentDate: dateColumn("payment_date"),
    reference: varchar("reference", 120, true),
    paidById: uuidColumn("paid_by_id", true),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    payrollItem: manyToOne("PayrollItem", "payroll_item_id", "CASCADE"),
    account: manyToOne("Account", "account_id"),
  },
  indices: [
    { name: "IDX_payroll_payments_item", columns: ["payrollItemId"] },
    { name: "IDX_payroll_payments_employee", columns: ["organizationId", "employeeId"] },
  ],
  checks: [{ name: "CHK_payroll_payments_amount", expression: `"amount" > 0` }],
});
