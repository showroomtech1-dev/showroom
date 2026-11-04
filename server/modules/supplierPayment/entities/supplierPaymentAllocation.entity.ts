import { EntitySchema } from "typeorm";
import { createdAt, manyToOne, moneyColumn, primaryId, uuidColumn } from "../../../infrastructure/database/columns";

export interface SupplierPaymentAllocation {
  id: string;
  paymentId: string;
  supplyId: string;
  amount: number;
  createdAt: Date;
  payment?: { id: string };
  supply?: { id: string };
}

export const SupplierPaymentAllocationEntity = new EntitySchema<SupplierPaymentAllocation>({
  name: "SupplierPaymentAllocation",
  tableName: "supplier_payment_allocations",
  columns: {
    id: primaryId(),
    paymentId: uuidColumn("payment_id"),
    supplyId: uuidColumn("supply_id"),
    amount: moneyColumn("amount"),
    createdAt: createdAt(),
  },
  relations: {
    payment: manyToOne("SupplierPayment", "payment_id", "CASCADE"),
    supply: manyToOne("Supply", "supply_id", "CASCADE"),
  },
  indices: [
    { name: "IDX_supplier_alloc_payment", columns: ["paymentId"] },
    { name: "IDX_supplier_alloc_supply", columns: ["supplyId"] },
  ],
  checks: [{ name: "CHK_supplier_alloc_amount", expression: `"amount" > 0` }],
});
