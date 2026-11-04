// Goods brought back. The return value first clears any balance the customer still owes on the
// sale (`appliedToBalance`); the rest is refunded in money (`refundAmount`).
import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface SaleReturn {
  id: string;
  organizationId: string;
  branchId: string;
  saleId: string;
  code: string;
  returnDate: string;
  reason: string | null;
  totalValue: number;
  taxReversed: number;
  costReversed: number;
  appliedToBalance: number;
  refundAmount: number;
  refundMethod: string | null;
  accountId: string | null;
  processedById: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  sale?: { id: string };
}

export const SaleReturnEntity = new EntitySchema<SaleReturn>({
  name: "SaleReturn",
  tableName: "sale_returns",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    saleId: uuidColumn("sale_id"),
    code: varchar("code", 24),
    returnDate: dateColumn("return_date"),
    reason: textColumn("reason"),
    totalValue: moneyColumn("total_value"),
    taxReversed: moneyColumn("tax_reversed"),
    costReversed: moneyColumn("cost_reversed"),
    appliedToBalance: moneyColumn("applied_to_balance"),
    refundAmount: moneyColumn("refund_amount"),
    refundMethod: varchar("refund_method", 10, true),
    accountId: uuidColumn("account_id", true),
    processedById: uuidColumn("processed_by_id", true),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    sale: manyToOne("Sale", "sale_id"),
  },
  indices: [
    { name: "IDX_sale_returns_org_date", columns: ["organizationId", "returnDate"] },
    { name: "IDX_sale_returns_sale", columns: ["saleId"] },
    { name: "UQ_sale_returns_org_code", columns: ["organizationId", "code"], unique: true },
  ],
});
