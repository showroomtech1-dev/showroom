// A completed point-of-sale transaction. Figures are snapshotted at sale time (prices, cost,
// tax rate, commission rate) so later price changes never rewrite history.
// amountPaid / balanceDue / returnedAmount are only changed inside locked transactions.
import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  intColumn,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  timestampColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Sale {
  id: string;
  organizationId: string;
  branchId: string;
  code: string;
  customerId: string | null;
  soldById: string;
  soldAt: Date;
  status: string;
  subtotal: number;
  discountTotal: number;
  taxRateBps: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  dueDate: string | null;
  costTotal: number;
  commissionRateBps: number;
  commissionAmount: number;
  returnedAmount: number;
  notes: string | null;
  receiptToken: string;
  quotationId: string | null;
  clientRef: string | null;
  voidedAt: Date | null;
  voidedById: string | null;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  branch?: { id: string };
  customer?: { id: string };
  soldBy?: { id: string };
}

export const SaleEntity = new EntitySchema<Sale>({
  name: "Sale",
  tableName: "sales",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    code: varchar("code", 24),
    customerId: uuidColumn("customer_id", true),
    soldById: uuidColumn("sold_by_id"),
    soldAt: timestampColumn("sold_at", false),
    status: varchar("status", 12, false, "completed"),
    subtotal: moneyColumn("subtotal"),
    discountTotal: moneyColumn("discount_total"),
    taxRateBps: intColumn("tax_rate_bps", 0),
    taxAmount: moneyColumn("tax_amount"),
    total: moneyColumn("total"),
    amountPaid: moneyColumn("amount_paid"),
    balanceDue: moneyColumn("balance_due"),
    paymentStatus: varchar("payment_status", 10, false, "paid"),
    dueDate: dateColumn("due_date", true),
    costTotal: moneyColumn("cost_total"),
    commissionRateBps: intColumn("commission_rate_bps", 0),
    commissionAmount: moneyColumn("commission_amount"),
    returnedAmount: moneyColumn("returned_amount"),
    notes: textColumn("notes"),
    receiptToken: varchar("receipt_token", 48),
    quotationId: uuidColumn("quotation_id", true),
    clientRef: varchar("client_ref", 64, true),
    voidedAt: timestampColumn("voided_at"),
    voidedById: uuidColumn("voided_by_id", true),
    voidReason: varchar("void_reason", 255, true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    branch: manyToOne("Branch", "branch_id"),
    customer: manyToOne("Customer", "customer_id"),
    soldBy: manyToOne("User", "sold_by_id"),
  },
  indices: [
    { name: "IDX_sales_org_sold_at", columns: ["organizationId", "soldAt"] },
    { name: "IDX_sales_org_branch_sold_at", columns: ["organizationId", "branchId", "soldAt"] },
    { name: "IDX_sales_org_customer", columns: ["organizationId", "customerId"] },
    { name: "IDX_sales_org_seller", columns: ["organizationId", "soldById", "soldAt"] },
    { name: "IDX_sales_org_balance", columns: ["organizationId", "paymentStatus", "dueDate"] },
    { name: "UQ_sales_org_code", columns: ["organizationId", "code"], unique: true },
    { name: "UQ_sales_receipt_token", columns: ["receiptToken"], unique: true },
    { name: "UQ_sales_client_ref", columns: ["organizationId", "clientRef"], unique: true, where: "client_ref IS NOT NULL" },
  ],
  checks: [
    { name: "CHK_sales_balance", expression: `"balance_due" >= 0` },
    { name: "CHK_sales_status", expression: `"status" IN ('completed', 'voided')` },
  ],
});
