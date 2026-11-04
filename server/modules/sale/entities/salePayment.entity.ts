// Money taken at the till for a sale (a sale may be split across methods, e.g. part cash part POS).
import { EntitySchema } from "typeorm";
import { createdAt, manyToOne, moneyColumn, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface SalePayment {
  id: string;
  organizationId: string;
  saleId: string;
  method: string;
  accountId: string;
  amount: number;
  reference: string | null;
  createdAt: Date;
  sale?: { id: string };
  account?: { id: string };
}

export const SalePaymentEntity = new EntitySchema<SalePayment>({
  name: "SalePayment",
  tableName: "sale_payments",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    saleId: uuidColumn("sale_id"),
    method: varchar("method", 10),
    accountId: uuidColumn("account_id"),
    amount: moneyColumn("amount"),
    reference: varchar("reference", 120, true),
    createdAt: createdAt(),
  },
  relations: {
    sale: manyToOne("Sale", "sale_id", "CASCADE"),
    account: manyToOne("Account", "account_id"),
  },
  indices: [{ name: "IDX_sale_payments_sale", columns: ["saleId"] }],
  checks: [{ name: "CHK_sale_payments_amount", expression: `"amount" > 0` }],
});
