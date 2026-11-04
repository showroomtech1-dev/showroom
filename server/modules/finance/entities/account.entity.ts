// A place money lives: cash in hand, a bank account, or a POS terminal settlement account.
// Balance = openingBalance + Σ in − Σ out over account_transactions.
import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  deletedAt,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Account {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  type: string;
  bankName: string | null;
  accountNumber: string | null;
  openingBalance: number;
  isDefault: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  branch?: { id: string };
}

export const AccountEntity = new EntitySchema<Account>({
  name: "Account",
  tableName: "accounts",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id", true),
    name: varchar("name", 120),
    type: varchar("type", 10),
    bankName: varchar("bank_name", 120, true),
    accountNumber: varchar("account_number", 30, true),
    openingBalance: moneyColumn("opening_balance"),
    isDefault: boolColumn("is_default", false),
    isActive: boolColumn("is_active", true),
    notes: textColumn("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    branch: manyToOne("Branch", "branch_id", "SET NULL"),
  },
  indices: [{ name: "IDX_accounts_org_type", columns: ["organizationId", "type"] }],
  checks: [{ name: "CHK_accounts_type", expression: `"type" IN ('cash', 'bank', 'pos')` }],
});
