import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  deletedAt,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Customer {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  /** Optional cap on outstanding credit (null = no limit). */
  creditLimit: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const CustomerEntity = new EntitySchema<Customer>({
  name: "Customer",
  tableName: "customers",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    code: varchar("code", 20),
    name: varchar("name", 160),
    phone: varchar("phone", 30, true),
    email: varchar("email", 160, true),
    address: textColumn("address"),
    notes: textColumn("notes"),
    creditLimit: moneyColumn("credit_limit", true),
    isActive: boolColumn("is_active", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [
    { name: "IDX_customers_org_name", columns: ["organizationId", "name"] },
    { name: "UQ_customers_org_code", columns: ["organizationId", "code"], unique: true },
    {
      name: "UQ_customers_org_phone",
      columns: ["organizationId", "phone"],
      unique: true,
      where: "phone IS NOT NULL AND deleted_at IS NULL",
    },
  ],
});
