// Append-only stock history: every receipt, sale, return, adjustment, count and transfer.
import { EntitySchema } from "typeorm";
import {
  createdAt,
  manyToOne,
  moneyColumn,
  primaryId,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface StockMovement {
  id: string;
  organizationId: string;
  branchId: string;
  variantId: string;
  productId: string;
  type: string;
  quantityChange: number;
  balanceAfter: number;
  unitCost: number;
  reason: string | null;
  note: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdById: string | null;
  createdAt: Date;
  variant?: { id: string };
  branch?: { id: string };
}

export const StockMovementEntity = new EntitySchema<StockMovement>({
  name: "StockMovement",
  tableName: "stock_movements",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    variantId: uuidColumn("variant_id"),
    productId: uuidColumn("product_id"),
    type: varchar("type", 20),
    quantityChange: { type: "int", name: "quantity_change" },
    balanceAfter: { type: "int", name: "balance_after" },
    unitCost: moneyColumn("unit_cost"),
    reason: varchar("reason", 30, true),
    note: varchar("note", 255, true),
    referenceType: varchar("reference_type", 40, true),
    referenceId: uuidColumn("reference_id", true),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
  },
  relations: {
    variant: manyToOne("ProductVariant", "variant_id", "CASCADE"),
    branch: manyToOne("Branch", "branch_id", "CASCADE"),
  },
  indices: [
    { name: "IDX_stock_movements_variant_created", columns: ["variantId", "createdAt"] },
    { name: "IDX_stock_movements_org_created", columns: ["organizationId", "createdAt"] },
    { name: "IDX_stock_movements_reference", columns: ["organizationId", "referenceType", "referenceId"] },
  ],
  checks: [{ name: "CHK_stock_movements_nonzero", expression: `"quantity_change" <> 0` }],
});
