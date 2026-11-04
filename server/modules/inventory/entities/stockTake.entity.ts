// A physical stock count. Started with a snapshot of system quantities; counts are entered,
// then completing it posts `stock_take` movements for every variance.
import { EntitySchema } from "typeorm";
import {
  createdAt,
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

export interface StockTake {
  id: string;
  organizationId: string;
  branchId: string;
  code: string;
  status: string;
  notes: string | null;
  itemsCounted: number;
  varianceQuantity: number;
  varianceValue: number;
  createdById: string | null;
  completedById: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  branch?: { id: string };
}

export const StockTakeEntity = new EntitySchema<StockTake>({
  name: "StockTake",
  tableName: "stock_takes",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    code: varchar("code", 24),
    status: varchar("status", 15, false, "in_progress"),
    notes: textColumn("notes"),
    itemsCounted: intColumn("items_counted", 0),
    varianceQuantity: intColumn("variance_quantity", 0),
    varianceValue: moneyColumn("variance_value"),
    createdById: uuidColumn("created_by_id", true),
    completedById: uuidColumn("completed_by_id", true),
    completedAt: timestampColumn("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    branch: manyToOne("Branch", "branch_id"),
  },
  indices: [{ name: "IDX_stock_takes_org_created", columns: ["organizationId", "createdAt"] }],
});
