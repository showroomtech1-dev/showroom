import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { PermissionCache } from "../../../shared/access/permissionCache";
import { AppError } from "../../../shared/errors/AppError";
import { FileResult } from "../../../shared/http/handler";
import type { Actor } from "../../../shared/types/actor";
import { todayIn } from "../../../shared/utils/dates";
import { AuditService } from "../../audit/services/audit.service";
import { SettingsService } from "../../organization/services/settings.service";
import { RESTORABLE, SystemRepository, type RestorableType } from "../repositories/system.repository";

export class SystemService {
  static Instance = new SystemService();
  private constructor(
    private readonly repo = SystemRepository.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  /** Full JSON export of the business's data (passwords and session tokens are never included). */
  async backup(actor: Actor): Promise<FileResult> {
    assertPermission(actor, "backup.manage");
    const { timezone } = await this.settings.get(actor.organizationId);
    const tables = await this.repo.exportAll(actor.organizationId);
    const payload = {
      format: "showroompro-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: actor.email,
      organizationId: actor.organizationId,
      counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
      tables,
    };
    await this.audit.log(actor, { action: "export", entityType: "backup", entityId: actor.organizationId, summary: "Downloaded a full data backup" });
    return new FileResult(`showroompro-backup-${todayIn(timezone)}.json`, "application/json", Buffer.from(JSON.stringify(payload)));
  }

  trashTypes() {
    return Object.keys(RESTORABLE);
  }

  async trash(actor: Actor, type: RestorableType, limit: number) {
    assertPermission(actor, "trash.manage");
    return this.repo.trash(actor.organizationId, type, limit);
  }

  async restore(actor: Actor, type: RestorableType, id: string) {
    assertPermission(actor, "trash.manage");
    if (type === "user") assertPermission(actor, "user.manage");
    const restored = await inTransaction(async (tx) => {
      const row = await this.repo.restore(actor.organizationId, type, id, tx);
      if (!row) throw AppError.notFound("Nothing to restore — the record was not found in the trash");
      await this.audit.log(actor, { action: "restore", entityType: type, entityId: id, summary: `Restored ${type.replace("_", " ")} ${row.label}` }, tx);
      return row;
    });
    if (type === "user") PermissionCache.invalidateUser(id);
    return { type, id, label: restored.label };
  }
}
