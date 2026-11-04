import { SqlParams } from "../../../infrastructure/database/sql";
import { db } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { num } from "../../../shared/utils/money";

export interface NotificationDTO {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  branchId: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface AlertInput {
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  branchId: string | null;
  permission: string;
  dedupeKey: string;
}

export interface Audience {
  userId: string;
  permissions: readonly string[];
  /** null = every branch. */
  branchId: string | null;
}

export class NotificationRepository {
  static Instance = new NotificationRepository();
  private constructor() {}

  private audienceWhere(p: SqlParams, organizationId: string, a: Audience): string[] {
    const where = [`n.organization_id = ${p.add(organizationId)}`, "n.resolved_at IS NULL"];
    if (!a.permissions.includes("*")) where.push(`(n.permission IS NULL OR n.permission = ANY(${p.add([...a.permissions])}::text[]))`);
    if (a.branchId) where.push(`(n.branch_id IS NULL OR n.branch_id = ${p.add(a.branchId)})`);
    return where;
  }

  async list(organizationId: string, a: Audience, f: { page: number; limit: number; unreadOnly?: boolean }): Promise<PagedRows<NotificationDTO>> {
    const p = new SqlParams();
    const userParam = p.add(a.userId);
    const where = this.audienceWhere(p, organizationId, a);
    if (f.unreadOnly) where.push("r.user_id IS NULL");
    const rows = await db().query(
      `SELECT n.id, n.type, n.severity, n.title, n.body, n.entity_type AS "entityType", n.entity_id AS "entityId",
              n.branch_id AS "branchId", (r.user_id IS NOT NULL) AS "isRead", n.created_at AS "createdAt",
              COUNT(*) OVER() AS "__total"
       FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ${userParam}
       WHERE ${where.join(" AND ")}
       ORDER BY n.created_at DESC
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<NotificationDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async unreadCount(organizationId: string, a: Audience): Promise<number> {
    const p = new SqlParams();
    const userParam = p.add(a.userId);
    const where = this.audienceWhere(p, organizationId, a);
    const rows: Array<{ count: number }> = await db().query(
      `SELECT COUNT(*) AS count FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ${userParam}
       WHERE ${where.join(" AND ")} AND r.user_id IS NULL`,
      p.values
    );
    return num(rows[0]?.count);
  }

  async markRead(organizationId: string, userId: string, notificationId: string): Promise<boolean> {
    const rows: Array<{ id: string }> = await db().query(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT n.id, $3 FROM notifications n WHERE n.id = $2 AND n.organization_id = $1
       ON CONFLICT DO NOTHING
       RETURNING notification_id AS id`,
      [organizationId, notificationId, userId]
    );
    if (rows.length > 0) return true;
    const exists: Array<{ id: string }> = await db().query(
      `SELECT id FROM notifications WHERE id = $1 AND organization_id = $2`,
      [notificationId, organizationId]
    );
    return exists.length > 0;
  }

  async markAllRead(organizationId: string, a: Audience): Promise<void> {
    const p = new SqlParams();
    const userParam = p.add(a.userId);
    const where = this.audienceWhere(p, organizationId, a);
    await db().query(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT n.id, ${userParam} FROM notifications n WHERE ${where.join(" AND ")}
       ON CONFLICT DO NOTHING`,
      p.values
    );
  }

  /** Opens an alert unless an unresolved one with the same key already exists. */
  async open(organizationId: string, alert: AlertInput): Promise<void> {
    await db().query(
      `INSERT INTO notifications (organization_id, branch_id, type, severity, title, body, entity_type, entity_id, permission, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (organization_id, dedupe_key) WHERE resolved_at IS NULL DO NOTHING`,
      [organizationId, alert.branchId, alert.type, alert.severity, alert.title, alert.body, alert.entityType, alert.entityId, alert.permission, alert.dedupeKey]
    );
  }

  /** Resolves open alerts of the given types whose key is no longer in `activeKeys`. */
  async resolveStale(organizationId: string, types: string[], activeKeys: string[]): Promise<void> {
    await db().query(
      `UPDATE notifications SET resolved_at = now()
       WHERE organization_id = $1 AND resolved_at IS NULL AND type = ANY($2::text[])
         AND NOT (dedupe_key = ANY($3::text[]))`,
      [organizationId, types, activeKeys]
    );
  }

  async purgeOld(): Promise<void> {
    await db().query(`DELETE FROM notifications WHERE resolved_at < now() - interval '90 days'`);
  }
}
