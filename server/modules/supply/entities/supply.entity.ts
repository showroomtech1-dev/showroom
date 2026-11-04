// Goods (or a service bill) received from a supplier/vendor. `amountPaid` and `paymentStatus`
// are maintained inside locked transactions by payment allocations.
import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Supply {
  id: string;
  organizationId: string;
  branchId: string;
  supplierId: string;
  code: string;
  invoiceNumber: string | null;
  supplyDate: string;
  dueDate: string | null;
  subtotal: number;
  discount: number;
  totalCost: number;
  amountPaid: number;
  paymentStatus: string;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  branch?: { id: string };
  supplier?: { id: string };
}

export const SupplyEntity = new EntitySchema<Supply>({
  name: "Supply",
  tableName: "supplies",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    supplierId: uuidColumn("supplier_id"),
    code: varchar("code", 24),
    invoiceNumber: varchar("invoice_number", 60, true),
    supplyDate: dateColumn("supply_date"),
    dueDate: dateColumn("due_date", true),
    subtotal: moneyColumn("subtotal"),
    discount: moneyColumn("discount"),
    totalCost: moneyColumn("total_cost"),
    amountPaid: moneyColumn("amount_paid"),
    paymentStatus: varchar("payment_status", 10, false, "credit"),
    notes: textColumn("notes"),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    branch: manyToOne("Branch", "branch_id"),
    supplier: manyToOne("Supplier", "supplier_id"),
  },
  indices: [
    { name: "IDX_supplies_org_supplier", columns: ["organizationId", "supplierId"] },
    { name: "IDX_supplies_org_date", columns: ["organizationId", "supplyDate"] },
    { name: "IDX_supplies_org_status_due", columns: ["organizationId", "paymentStatus", "dueDate"] },
    { name: "UQ_supplies_org_code", columns: ["organizationId", "code"], unique: true },
  ],
  checks: [
    { name: "CHK_supplies_paid", expression: `"amount_paid" >= 0 AND "amount_paid" <= "total_cost"` },
    { name: "CHK_supplies_status", expression: `"payment_status" IN ('paid', 'part_paid', 'credit')` },
  ],
});
