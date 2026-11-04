// Money-movement ledger. Every sale payment, refund, supplier payment, expense, salary payment,
// loan and transfer posts one row here in the same transaction as the source record.
// Rows are never edited: a correction posts a `reversal` row.
import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  manyToOne,
  moneyColumn,
  primaryId,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface AccountTransaction {
  id: string;
  organizationId: string;
  accountId: string;
  branchId: string | null;
  transactionDate: string;
  direction: "in" | "out";
  amount: number;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string;
  createdById: string | null;
  createdAt: Date;
  account?: { id: string };
}

export const AccountTransactionEntity = new EntitySchema<AccountTransaction>({
  name: "AccountTransaction",
  tableName: "account_transactions",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    accountId: uuidColumn("account_id"),
    branchId: uuidColumn("branch_id", true),
    transactionDate: dateColumn("transaction_date"),
    direction: varchar("direction", 3),
    amount: moneyColumn("amount"),
    type: varchar("type", 30),
    referenceType: varchar("reference_type", 40, true),
    referenceId: uuidColumn("reference_id", true),
    description: varchar("description", 255),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
  },
  relations: { account: manyToOne("Account", "account_id") },
  indices: [
    { name: "IDX_account_tx_account_date", columns: ["accountId", "transactionDate"] },
    { name: "IDX_account_tx_org_date", columns: ["organizationId", "transactionDate"] },
    { name: "IDX_account_tx_reference", columns: ["organizationId", "referenceType", "referenceId"] },
  ],
  checks: [
    { name: "CHK_account_tx_amount", expression: `"amount" > 0` },
    { name: "CHK_account_tx_direction", expression: `"direction" IN ('in', 'out')` },
  ],
});
