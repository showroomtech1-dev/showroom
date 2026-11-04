import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  deletedAt,
  manyToOne,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isMain: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const BranchEntity = new EntitySchema<Branch>({
  name: "Branch",
  tableName: "branches",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    name: varchar("name", 120),
    code: varchar("code", 20),
    address: textColumn("address"),
    phone: varchar("phone", 30, true),
    isMain: boolColumn("is_main", false),
    isActive: boolColumn("is_active", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [
    { name: "IDX_branches_org", columns: ["organizationId"] },
    { name: "UQ_branches_org_code", columns: ["organizationId", "code"], unique: true, where: "deleted_at IS NULL" },
  ],
});
