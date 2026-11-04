import { EntitySchema } from "typeorm";
import { intColumn, manyToOne, moneyColumn, primaryId, timestampColumn, uuidColumn } from "../../../infrastructure/database/columns";

export interface StockTakeItem {
  id: string;
  stockTakeId: string;
  variantId: string;
  productId: string;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  unitCost: number;
  countedAt: Date | null;
  stockTake?: { id: string };
  variant?: { id: string };
}

export const StockTakeItemEntity = new EntitySchema<StockTakeItem>({
  name: "StockTakeItem",
  tableName: "stock_take_items",
  columns: {
    id: primaryId(),
    stockTakeId: uuidColumn("stock_take_id"),
    variantId: uuidColumn("variant_id"),
    productId: uuidColumn("product_id"),
    systemQuantity: intColumn("system_quantity", 0),
    countedQuantity: intColumn("counted_quantity", null),
    variance: intColumn("variance", null),
    unitCost: moneyColumn("unit_cost"),
    countedAt: timestampColumn("counted_at"),
  },
  relations: {
    stockTake: manyToOne("StockTake", "stock_take_id", "CASCADE"),
    variant: manyToOne("ProductVariant", "variant_id", "CASCADE"),
  },
  indices: [{ name: "UQ_stock_take_items_take_variant", columns: ["stockTakeId", "variantId"], unique: true }],
});
