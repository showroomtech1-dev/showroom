import { EntitySchema } from "typeorm";
import { intColumn, manyToOne, moneyColumn, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface SaleItem {
  id: string;
  saleId: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  /** Price actually charged per unit (may differ from listPrice with sale.priceoverride). */
  unitPrice: number;
  listPrice: number;
  /** Line discount (whole line, not per unit). */
  discount: number;
  lineTotal: number;
  /** Cost per unit at the time of sale (COGS). */
  unitCost: number;
  returnedQuantity: number;
  sale?: { id: string };
  variant?: { id: string };
}

export const SaleItemEntity = new EntitySchema<SaleItem>({
  name: "SaleItem",
  tableName: "sale_items",
  columns: {
    id: primaryId(),
    saleId: uuidColumn("sale_id"),
    variantId: uuidColumn("variant_id"),
    productId: uuidColumn("product_id"),
    productName: varchar("product_name", 160),
    variantName: varchar("variant_name", 120, true),
    sku: varchar("sku", 60),
    quantity: { type: "int", name: "quantity" },
    unitPrice: moneyColumn("unit_price"),
    listPrice: moneyColumn("list_price"),
    discount: moneyColumn("discount"),
    lineTotal: moneyColumn("line_total"),
    unitCost: moneyColumn("unit_cost"),
    returnedQuantity: intColumn("returned_quantity", 0),
  },
  relations: {
    sale: manyToOne("Sale", "sale_id", "CASCADE"),
    variant: manyToOne("ProductVariant", "variant_id"),
  },
  indices: [
    { name: "IDX_sale_items_sale", columns: ["saleId"] },
    { name: "IDX_sale_items_variant", columns: ["variantId"] },
    { name: "IDX_sale_items_product", columns: ["productId"] },
  ],
  checks: [
    { name: "CHK_sale_items_quantity", expression: `"quantity" > 0` },
    { name: "CHK_sale_items_returned", expression: `"returned_quantity" >= 0 AND "returned_quantity" <= "quantity"` },
  ],
});
