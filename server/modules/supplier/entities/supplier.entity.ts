// Suppliers (goods) and vendors (services: cleaners, repairers, utilities) share one table, split by `type`.
import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  deletedAt,
  intColumn,
  manyToOne,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Supplier {
  id: string;
  organizationId: string;
  code: string;
  type: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  paymentTermsDays: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const SupplierEntity = new EntitySchema<Supplier>({
  name: "Supplier",
  tableName: "suppliers",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    code: varchar("code", 20),
    type: varchar("type", 10, false, "supplier"),
    name: varchar("name", 160),
    contactPerson: varchar("contact_person", 120, true),
    phone: varchar("phone", 30, true),
    email: varchar("email", 160, true),
    address: textColumn("address"),
    category: varchar("category", 80, true),
    bankName: varchar("bank_name", 120, true),
    bankAccountNumber: varchar("bank_account_number", 30, true),
    bankAccountName: varchar("bank_account_name", 160, true),
    paymentTermsDays: intColumn("payment_terms_days", null),
    notes: textColumn("notes"),
    isActive: boolColumn("is_active", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [
    { name: "IDX_suppliers_org_type", columns: ["organizationId", "type"] },
    { name: "IDX_suppliers_org_name", columns: ["organizationId", "name"] },
    { name: "UQ_suppliers_org_code", columns: ["organizationId", "code"], unique: true },
  ],
  checks: [{ name: "CHK_suppliers_type", expression: `"type" IN ('supplier', 'vendor')` }],
});
