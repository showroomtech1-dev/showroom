import { SqlParams, tzDateBetween } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { AuditListFilter, AuditLogDTO } from "../dto/audit.dto";
import type { AuditLog } from "../entities/auditLog.entity";

export class AuditRepository {
  static Instance = new AuditRepository();
  private constructor() {}

  async insert(entry: Omit<AuditLog, "id" | "createdAt" | "organization">, tx?: Tx): Promise<void> {
    await db(tx).query(
      `INSERT INTO audit_logs (organization_id, user_id, user_name, action, entity_type, entity_id, summary, before, after, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
      [
        entry.organizationId,
        entry.userId,
        entry.userName,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.summary,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        entry.ip,
      ]
    );
  }

  async list(organizationId: string, f: AuditListFilter): Promise<PagedRows<AuditLogDTO>> {
    const p = new SqlParams();
    const where = [`a.organization_id = ${p.add(organizationId)}`];
    if (f.entityType) where.push(`a.entity_type = ${p.add(f.entityType)}`);
    if (f.entityId) where.push(`a.entity_id = ${p.add(f.entityId)}`);
    if (f.userId) where.push(`a.user_id = ${p.add(f.userId)}`);
    if (f.action) where.push(`a.action = ${p.add(f.action)}`);
    if (f.from && f.to) where.push(tzDateBetween("a.created_at", p.add(f.from), p.add(f.to), p.add(f.timezone)));
    const rows = await db().query(
      `SELECT a.id, a.user_id AS "userId", a.user_name AS "userName", a.action, a.entity_type AS "entityType",
              a.entity_id AS "entityId", a.summary, a.before, a.after, a.ip, a.created_at AS "createdAt",
              COUNT(*) OVER() AS "__total"
       FROM audit_logs a
       WHERE ${where.join(" AND ")}
       ORDER BY a.created_at DESC
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<AuditLogDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }
}
