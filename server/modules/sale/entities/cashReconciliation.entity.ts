// End-of-day cash-up: what the system says should be in the cash account vs what was counted.
import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  dateColumn,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  uuidColumn,
} from "../../../infrastructure/database/columns";

export interface CashReconciliation {
  id: string;
  organizationId: string;
  branchId: string;
  accountId: string;
  reconDate: string;
  expectedAmount: number;
  countedAmount: number;
  /** counted − expected (negative = shortage). */
  difference: number;
  notes: string | null;
  adjustmentPosted: boolean;
  closedById: string | null;
  createdAt: Date;
  organization?: { id: string };
  account?: { id: string };
}

export const CashReconciliationEntity = new EntitySchema<CashReconciliation>({
  name: "CashReconciliation",
  tableName: "cash_reconciliations",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    accountId: uuidColumn("account_id"),
    reconDate: dateColumn("recon_date"),
    expectedAmount: moneyColumn("expected_amount"),
    countedAmount: moneyColumn("counted_amount"),
    difference: moneyColumn("difference"),
    notes: textColumn("notes"),
    adjustmentPosted: boolColumn("adjustment_posted", false),
    closedById: uuidColumn("closed_by_id", true),
    createdAt: createdAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    account: manyToOne("Account", "account_id"),
  },
  indices: [
    { name: "UQ_cash_recon_account_date", columns: ["accountId", "reconDate"], unique: true },
    { name: "IDX_cash_recon_org_date", columns: ["organizationId", "reconDate"] },
  ],
});
