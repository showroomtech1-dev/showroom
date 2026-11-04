// Current on-hand quantity of one variant at one branch. Only ever changed by an atomic
// `quantity = quantity + delta` update, always paired with a stock_movements row.
import { EntitySchema } from "typeorm";
import { intColumn, manyToOne, primaryId, updatedAt, uuidColumn } from "../../../infrastructure/database/columns";

export interface StockLevel {
  id: string;
  organizationId: string;
  variantId: string;
  branchId: string;
  quantity: number;
  updatedAt: Date;
  variant?: { id: string };
  branch?: { id: string };
}

export const StockLevelEntity = new EntitySchema<StockLevel>({
  name: "StockLevel",
  tableName: "stock_levels",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    variantId: uuidColumn("variant_id"),
    branchId: uuidColumn("branch_id"),
    quantity: intColumn("quantity", 0),
    updatedAt: updatedAt(),
  },
  relations: {
    variant: manyToOne("ProductVariant", "variant_id", "CASCADE"),
    branch: manyToOne("Branch", "branch_id", "CASCADE"),
  },
  indices: [
    { name: "UQ_stock_levels_variant_branch", columns: ["variantId", "branchId"], unique: true },
    { name: "IDX_stock_levels_org_branch", columns: ["organizationId", "branchId"] },
  ],
});
