import { EntitySchema } from "typeorm";
import { boolColumn, manyToOne, moneyColumn, primaryId, uuidColumn } from "../../../infrastructure/database/columns";

export interface SaleReturnItem {
  id: string;
  returnId: string;
  saleItemId: string;
  variantId: string;
  quantity: number;
  /** What the customer effectively paid for these units (after discounts, incl. tax). */
  lineValue: number;
  unitCost: number;
  /** false = damaged / not resellable: stock is not added back. */
  restock: boolean;
  saleReturn?: { id: string };
  saleItem?: { id: string };
}

export const SaleReturnItemEntity = new EntitySchema<SaleReturnItem>({
  name: "SaleReturnItem",
  tableName: "sale_return_items",
  columns: {
    id: primaryId(),
    returnId: uuidColumn("return_id"),
    saleItemId: uuidColumn("sale_item_id"),
    variantId: uuidColumn("variant_id"),
    quantity: { type: "int", name: "quantity" },
    lineValue: moneyColumn("line_value"),
    unitCost: moneyColumn("unit_cost"),
    restock: boolColumn("restock", true),
  },
  relations: {
    saleReturn: manyToOne("SaleReturn", "return_id", "CASCADE"),
    saleItem: manyToOne("SaleItem", "sale_item_id", "CASCADE"),
  },
  indices: [{ name: "IDX_sale_return_items_return", columns: ["returnId"] }],
  checks: [{ name: "CHK_sale_return_items_quantity", expression: `"quantity" > 0` }],
});
