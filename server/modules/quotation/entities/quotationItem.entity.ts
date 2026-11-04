import { EntitySchema } from "typeorm";
import { manyToOne, moneyColumn, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface QuotationItem {
  id: string;
  quotationId: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  quotation?: { id: string };
  variant?: { id: string };
}

export const QuotationItemEntity = new EntitySchema<QuotationItem>({
  name: "QuotationItem",
  tableName: "quotation_items",
  columns: {
    id: primaryId(),
    quotationId: uuidColumn("quotation_id"),
    variantId: uuidColumn("variant_id"),
    productId: uuidColumn("product_id"),
    productName: varchar("product_name", 160),
    variantName: varchar("variant_name", 120, true),
    quantity: { type: "int", name: "quantity" },
    unitPrice: moneyColumn("unit_price"),
    discount: moneyColumn("discount"),
    lineTotal: moneyColumn("line_total"),
  },
  relations: {
    quotation: manyToOne("Quotation", "quotation_id", "CASCADE"),
    variant: manyToOne("ProductVariant", "variant_id"),
  },
  indices: [{ name: "IDX_quotation_items_quotation", columns: ["quotationId"] }],
  checks: [{ name: "CHK_quotation_items_quantity", expression: `"quantity" > 0` }],
});
