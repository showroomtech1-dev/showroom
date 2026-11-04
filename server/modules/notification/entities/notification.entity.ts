// In-app alerts (low stock, due supplier payments, customer debts, recurring expenses).
// `dedupeKey` is unique among unresolved alerts, so the scanner never duplicates an open alert;
// alerts whose condition clears are resolved (hidden) automatically.
import { EntitySchema } from "typeorm";
import {
  createdAt,
  manyToOne,
  primaryId,
  textColumn,
  timestampColumn,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Notification {
  id: string;
  organizationId: string;
  branchId: string | null;
  type: string;
  severity: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  /** Only users holding this permission see the alert (null = everyone). */
  permission: string | null;
  dedupeKey: string;
  resolvedAt: Date | null;
  createdAt: Date;
  organization?: { id: string };
}

export const NotificationEntity = new EntitySchema<Notification>({
  name: "Notification",
  tableName: "notifications",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id", true),
    type: varchar("type", 40),
    severity: varchar("severity", 10, false, "info"),
    title: varchar("title", 160),
    body: textColumn("body"),
    entityType: varchar("entity_type", 40, true),
    entityId: uuidColumn("entity_id", true),
    permission: varchar("permission", 60, true),
    dedupeKey: varchar("dedupe_key", 160),
    resolvedAt: timestampColumn("resolved_at"),
    createdAt: createdAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [
    { name: "IDX_notifications_org_created", columns: ["organizationId", "createdAt"] },
    {
      name: "UQ_notifications_open_dedupe",
      columns: ["organizationId", "dedupeKey"],
      unique: true,
      where: "resolved_at IS NULL",
    },
  ],
});
