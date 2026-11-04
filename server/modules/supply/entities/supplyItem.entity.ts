import { EntitySchema } from "typeorm";
import { manyToOne, moneyColumn, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface SupplyItem {
  id: string;
  supplyId: string;
  /** Null for service bills from vendors (no stock involved). */
  variantId: string | null;
  productId: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supply?: { id: string };
  variant?: { id: string };
}

export const SupplyItemEntity = new EntitySchema<SupplyItem>({
  name: "SupplyItem",
  tableName: "supply_items",
  columns: {
    id: primaryId(),
    supplyId: uuidColumn("supply_id"),
    variantId: uuidColumn("variant_id", true),
    productId: uuidColumn("product_id", true),
    description: varchar("description", 200),
    quantity: { type: "int", name: "quantity" },
    unitCost: moneyColumn("unit_cost"),
    totalCost: moneyColumn("total_cost"),
  },
  relations: {
    supply: manyToOne("Supply", "supply_id", "CASCADE"),
    variant: manyToOne("ProductVariant", "variant_id"),
  },
  indices: [
    { name: "IDX_supply_items_supply", columns: ["supplyId"] },
    { name: "IDX_supply_items_variant", columns: ["variantId"] },
  ],
  checks: [{ name: "CHK_supply_items_quantity", expression: `"quantity" > 0` }],
});
