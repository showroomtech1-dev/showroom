// A payment made to a supplier/vendor. It is allocated to that supplier's unpaid supplies
// (oldest due first). Any part that exceeds what is owed is flagged as an over-payment.
import { EntitySchema } from "typeorm";
import {
  boolColumn,
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

export interface SupplierPayment {
  id: string;
  organizationId: string;
  supplierId: string;
  branchId: string | null;
  code: string;
  paymentDate: string;
  amount: number;
  method: string;
  accountId: string;
  reference: string | null;
  notes: string | null;
  proofUrl: string | null;
  proofPublicId: string | null;
  allocatedAmount: number;
  isOverpayment: boolean;
  overpaidAmount: number;
  clientRef: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  supplier?: { id: string };
  account?: { id: string };
}

export const SupplierPaymentEntity = new EntitySchema<SupplierPayment>({
  name: "SupplierPayment",
  tableName: "supplier_payments",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    supplierId: uuidColumn("supplier_id"),
    branchId: uuidColumn("branch_id", true),
    code: varchar("code", 24),
    paymentDate: dateColumn("payment_date"),
    amount: moneyColumn("amount"),
    method: varchar("method", 10),
    accountId: uuidColumn("account_id"),
    reference: varchar("reference", 120, true),
    notes: textColumn("notes"),
    proofUrl: varchar("proof_url", 500, true),
    proofPublicId: varchar("proof_public_id", 255, true),
    allocatedAmount: moneyColumn("allocated_amount"),
    isOverpayment: boolColumn("is_overpayment", false),
    overpaidAmount: moneyColumn("overpaid_amount"),
    clientRef: varchar("client_ref", 64, true),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    supplier: manyToOne("Supplier", "supplier_id"),
    account: manyToOne("Account", "account_id"),
  },
  indices: [
    { name: "IDX_supplier_payments_org_supplier", columns: ["organizationId", "supplierId"] },
    { name: "IDX_supplier_payments_org_date", columns: ["organizationId", "paymentDate"] },
    { name: "UQ_supplier_payments_org_code", columns: ["organizationId", "code"], unique: true },
    {
      name: "UQ_supplier_payments_client_ref",
      columns: ["organizationId", "clientRef"],
      unique: true,
      where: "client_ref IS NOT NULL",
    },
  ],
  checks: [{ name: "CHK_supplier_payments_amount", expression: `"amount" > 0` }],
});
