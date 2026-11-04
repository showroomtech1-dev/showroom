// A repeating bill (rent, internet subscription…). The scheduler raises a reminder as nextDueDate
// approaches; recording it creates a normal expense and moves nextDueDate forward.
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
  timestampColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface RecurringExpense {
  id: string;
  organizationId: string;
  branchId: string;
  categoryId: string;
  name: string;
  amount: number;
  method: string;
  accountId: string | null;
  payee: string | null;
  supplierId: string | null;
  frequency: string;
  startDate: string;
  nextDueDate: string;
  endDate: string | null;
  isActive: boolean;
  lastRecordedAt: Date | null;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  category?: { id: string };
}

export const RecurringExpenseEntity = new EntitySchema<RecurringExpense>({
  name: "RecurringExpense",
  tableName: "recurring_expenses",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    categoryId: uuidColumn("category_id"),
    name: varchar("name", 120),
    amount: moneyColumn("amount"),
    method: varchar("method", 10, false, "transfer"),
    accountId: uuidColumn("account_id", true),
    payee: varchar("payee", 160, true),
    supplierId: uuidColumn("supplier_id", true),
    frequency: varchar("frequency", 12, false, "monthly"),
    startDate: dateColumn("start_date"),
    nextDueDate: dateColumn("next_due_date"),
    endDate: dateColumn("end_date", true),
    isActive: boolColumn("is_active", true),
    lastRecordedAt: timestampColumn("last_recorded_at"),
    notes: textColumn("notes"),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    category: manyToOne("ExpenseCategory", "category_id"),
  },
  indices: [{ name: "IDX_recurring_expenses_org_due", columns: ["organizationId", "isActive", "nextDueDate"] }],
  checks: [{ name: "CHK_recurring_expenses_amount", expression: `"amount" > 0` }],
});
