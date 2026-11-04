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

export interface AccountTransfer {
  id: string;
  organizationId: string;
  code: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  transferDate: string;
  reference: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  fromAccount?: { id: string };
  toAccount?: { id: string };
}

export const AccountTransferEntity = new EntitySchema<AccountTransfer>({
  name: "AccountTransfer",
  tableName: "account_transfers",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    code: varchar("code", 24),
    fromAccountId: uuidColumn("from_account_id"),
    toAccountId: uuidColumn("to_account_id"),
    amount: moneyColumn("amount"),
    transferDate: dateColumn("transfer_date"),
    reference: varchar("reference", 120, true),
    notes: textColumn("notes"),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    fromAccount: manyToOne("Account", "from_account_id"),
    toAccount: manyToOne("Account", "to_account_id"),
  },
  indices: [{ name: "IDX_account_transfers_org_date", columns: ["organizationId", "transferDate"] }],
  checks: [{ name: "CHK_account_transfers_amount", expression: `"amount" > 0` }],
});
