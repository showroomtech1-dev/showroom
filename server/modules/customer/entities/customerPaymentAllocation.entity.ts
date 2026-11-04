import { EntitySchema } from "typeorm";
import { createdAt, manyToOne, moneyColumn, primaryId, uuidColumn } from "../../../infrastructure/database/columns";

export interface CustomerPaymentAllocation {
  id: string;
  paymentId: string;
  saleId: string;
  amount: number;
  createdAt: Date;
  payment?: { id: string };
  sale?: { id: string };
}

export const CustomerPaymentAllocationEntity = new EntitySchema<CustomerPaymentAllocation>({
  name: "CustomerPaymentAllocation",
  tableName: "customer_payment_allocations",
  columns: {
    id: primaryId(),
    paymentId: uuidColumn("payment_id"),
    saleId: uuidColumn("sale_id"),
    amount: moneyColumn("amount"),
    createdAt: createdAt(),
  },
  relations: {
    payment: manyToOne("CustomerPayment", "payment_id", "CASCADE"),
    sale: manyToOne("Sale", "sale_id", "CASCADE"),
  },
  indices: [
    { name: "IDX_customer_alloc_payment", columns: ["paymentId"] },
    { name: "IDX_customer_alloc_sale", columns: ["saleId"] },
  ],
  checks: [{ name: "CHK_customer_alloc_amount", expression: `"amount" > 0` }],
});
