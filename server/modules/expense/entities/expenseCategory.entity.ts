import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  deletedAt,
  manyToOne,
  primaryId,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface ExpenseCategory {
  id: string;
  organizationId: string;
  name: string;
  /** Seeded defaults (rent, electricity…) — can be hidden but not deleted. */
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const ExpenseCategoryEntity = new EntitySchema<ExpenseCategory>({
  name: "ExpenseCategory",
  tableName: "expense_categories",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    name: varchar("name", 80),
    isSystem: boolColumn("is_system", false),
    isActive: boolColumn("is_active", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [
    { name: "UQ_expense_categories_org_name", columns: ["organizationId", "name"], unique: true, where: "deleted_at IS NULL" },
  ],
});
