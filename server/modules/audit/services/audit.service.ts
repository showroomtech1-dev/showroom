// Audit trail. Financial writes call record() with their transaction so the log row commits (or
// rolls back) together with the change. Non-critical callers may omit tx.
import type { Tx } from "../../../infrastructure/database/transaction";
import { resolveRange } from "../../../shared/utils/dates";
import type { Actor } from "../../../shared/types/actor";
import { SettingsService } from "../../organization/services/settings.service";
import type { AuditEntryInput, AuditListFilter } from "../dto/audit.dto";
import { AuditRepository } from "../repositories/audit.repository";
import type { ListAuditQuery } from "../validators/audit.schema";

/** Drop secrets and bulky fields before storing a snapshot. */
function sanitize(snapshot: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!snapshot) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (/password|token|secret/i.test(key)) continue;
    if (value !== null && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) continue;
    out[key] = value;
  }
  return out;
}

export class AuditService {
  static Instance = new AuditService();
  private constructor(
    private readonly repo = AuditRepository.Instance,
    private readonly settings = SettingsService.Instance
  ) {}

  async record(actor: Actor | null, organizationId: string, entry: AuditEntryInput, tx?: Tx): Promise<void> {
    await this.repo.insert(
      {
        organizationId,
        userId: actor?.id ?? null,
        userName: actor?.name ?? "System",
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary.slice(0, 255),
        before: sanitize(entry.before),
        after: sanitize(entry.after),
        ip: actor?.ip ?? null,
      },
      tx
    );
  }

  /** Shorthand for the common case: the actor's own organisation. */
  log(actor: Actor, entry: AuditEntryInput, tx?: Tx): Promise<void> {
    return this.record(actor, actor.organizationId, entry, tx);
  }

  async list(actor: Actor, query: ListAuditQuery) {
    const { timezone } = await this.settings.get(actor.organizationId);
    const range = query.from || query.to ? resolveRange(timezone, query.from, query.to) : null;
    const filter: AuditListFilter = { ...query, timezone, from: range?.from, to: range?.to };
    return this.repo.list(actor.organizationId, filter);
  }
}
