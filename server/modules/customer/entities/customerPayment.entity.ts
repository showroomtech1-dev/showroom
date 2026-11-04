// A customer paying down their debt after the sale. Allocated to their unpaid sales, oldest first.
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

export interface CustomerPayment {
  id: string;
  organizationId: string;
  customerId: string;
  branchId: string | null;
  code: string;
  paymentDate: string;
  amount: number;
  method: string;
  accountId: string;
  reference: string | null;
  notes: string | null;
  allocatedAmount: number;
  clientRef: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  customer?: { id: string };
  account?: { id: string };
}

export const CustomerPaymentEntity = new EntitySchema<CustomerPayment>({
  name: "CustomerPayment",
  tableName: "customer_payments",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    customerId: uuidColumn("customer_id"),
    branchId: uuidColumn("branch_id", true),
    code: varchar("code", 24),
    paymentDate: dateColumn("payment_date"),
    amount: moneyColumn("amount"),
    method: varchar("method", 10),
    accountId: uuidColumn("account_id"),
    reference: varchar("reference", 120, true),
    notes: textColumn("notes"),
    allocatedAmount: moneyColumn("allocated_amount"),
    clientRef: varchar("client_ref", 64, true),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    customer: manyToOne("Customer", "customer_id"),
    account: manyToOne("Account", "account_id"),
  },
  indices: [
    { name: "IDX_customer_payments_org_customer", columns: ["organizationId", "customerId"] },
    { name: "IDX_customer_payments_org_date", columns: ["organizationId", "paymentDate"] },
    { name: "UQ_customer_payments_org_code", columns: ["organizationId", "code"], unique: true },
    {
      name: "UQ_customer_payments_client_ref",
      columns: ["organizationId", "clientRef"],
      unique: true,
      where: "client_ref IS NOT NULL",
    },
  ],
  checks: [{ name: "CHK_customer_payments_amount", expression: `"amount" > 0` }],
});
