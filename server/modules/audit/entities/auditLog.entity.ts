// Append-only record of who created, edited or deleted what (financial records especially).
// Written in the same transaction as the change it describes.
import { EntitySchema } from "typeorm";
import { createdAt, jsonColumn, manyToOne, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  createdAt: Date;
  organization?: { id: string };
}

export const AuditLogEntity = new EntitySchema<AuditLog>({
  name: "AuditLog",
  tableName: "audit_logs",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    userId: uuidColumn("user_id", true),
    userName: varchar("user_name", 120, true),
    action: varchar("action", 40),
    entityType: varchar("entity_type", 60),
    entityId: uuidColumn("entity_id", true),
    summary: varchar("summary", 255),
    before: jsonColumn("before"),
    after: jsonColumn("after"),
    ip: varchar("ip", 64, true),
    createdAt: createdAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [
    { name: "IDX_audit_logs_org_created", columns: ["organizationId", "createdAt"] },
    { name: "IDX_audit_logs_entity", columns: ["organizationId", "entityType", "entityId"] },
    { name: "IDX_audit_logs_user", columns: ["organizationId", "userId"] },
  ],
});
