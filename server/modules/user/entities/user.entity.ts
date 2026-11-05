import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  deletedAt,
  manyToOne,
  primaryId,
  timestampColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface User {
  id: string;
  organizationId: string;
  branchId: string | null;
  roleId: string;
  name: string;
  /** Always stored lower-case — lookups compare against the lower-cased input. */
  email: string;
  passwordHash: string;
  phone: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  /** Last API call or live connection (throttled). */
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  branch?: { id: string };
  role?: { id: string };
}

export const UserEntity = new EntitySchema<User>({
  name: "User",
  tableName: "users",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id", true),
    roleId: uuidColumn("role_id"),
    name: varchar("name", 120),
    email: varchar("email", 160),
    passwordHash: varchar("password_hash", 100),
    phone: varchar("phone", 30, true),
    isActive: boolColumn("is_active", true),
    mustChangePassword: boolColumn("must_change_password", false),
    lastLoginAt: timestampColumn("last_login_at"),
    lastSeenAt: timestampColumn("last_seen_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    branch: manyToOne("Branch", "branch_id", "SET NULL"),
    role: manyToOne("Role", "role_id"),
  },
  indices: [
    { name: "IDX_users_org", columns: ["organizationId"] },
    { name: "UQ_users_email", columns: ["email"], unique: true, where: "deleted_at IS NULL" },
  ],
});
