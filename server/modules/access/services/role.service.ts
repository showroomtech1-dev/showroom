import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { PermissionCache } from "../../../shared/access/permissionCache";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { PERMISSIONS, type PermissionCode } from "../catalog/permissions.catalog";
import { BUILT_IN_ROLES } from "../catalog/roles.catalog";
import { RoleRepository, type RoleDTO } from "../repositories/role.repository";
import type { CreateRoleInput, UpdateRoleInput } from "../validators/role.schema";

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30) || "role";

export class RoleService {
  static Instance = new RoleService();
  private constructor(
    private readonly repo = RoleRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  catalog() {
    return PERMISSIONS;
  }

  async list(actor: Actor): Promise<RoleDTO[]> {
    return this.repo.list(actor.organizationId);
  }

  async get(actor: Actor, id: string, tx?: Tx): Promise<RoleDTO> {
    const role = await this.repo.findById(actor.organizationId, id, tx);
    if (!role) throw AppError.notFound("Role not found");
    return role;
  }

  /** Seeds the built-in roles for a new organisation. Returns key → role id. */
  async seedBuiltIns(organizationId: string, tx: Tx): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    for (const role of BUILT_IN_ROLES) {
      const existing = await this.repo.findByKey(organizationId, role.key, tx);
      ids[role.key] =
        existing?.id ??
        (await this.repo.create(
          {
            organizationId,
            key: role.key,
            name: role.name,
            description: role.description,
            permissions: [...role.permissions],
            isBuiltIn: true,
            isLocked: role.locked,
          },
          tx
        ));
    }
    return ids;
  }

  /** You cannot hand out permissions you don't hold yourself. */
  private assertCanGrant(actor: Actor, permissions: PermissionCode[]): void {
    const missing = permissions.filter((code) => !can(actor, code));
    if (missing.length > 0) throw AppError.forbidden(`You cannot grant permissions you don't have: ${missing.join(", ")}`);
  }

  async create(actor: Actor, data: CreateRoleInput): Promise<RoleDTO> {
    assertPermission(actor, "role.manage");
    this.assertCanGrant(actor, data.permissions);
    return inTransaction(async (tx) => {
      const id = await this.repo.create(
        {
          organizationId: actor.organizationId,
          key: `${slug(data.name)}_${Date.now().toString(36)}`,
          name: data.name,
          description: data.description ?? null,
          permissions: data.permissions,
          isBuiltIn: false,
          isLocked: false,
        },
        tx
      );
      await this.audit.log(actor, { action: "create", entityType: "role", entityId: id, summary: `Created role ${data.name}`, after: { name: data.name, permissions: data.permissions.join(",") } }, tx);
      return this.get(actor, id, tx);
    });
  }

  async update(actor: Actor, id: string, data: UpdateRoleInput): Promise<RoleDTO> {
    assertPermission(actor, "role.manage");
    const role = await this.get(actor, id);
    if (role.isLocked) throw AppError.forbidden("The owner role cannot be changed");
    if (data.permissions) this.assertCanGrant(actor, data.permissions);
    if (data.permissions && role.id === actor.roleId) {
      throw AppError.badRequest("You cannot change the permissions of your own role");
    }
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, data, tx);
      await this.audit.log(
        actor,
        {
          action: "update",
          entityType: "role",
          entityId: id,
          summary: `Updated role ${role.name}`,
          before: { name: role.name, permissions: role.permissions.join(",") },
          after: { name: data.name ?? role.name, permissions: (data.permissions ?? role.permissions).join(",") },
        },
        tx
      );
    });
    PermissionCache.invalidateOrganization(actor.organizationId);
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "role.manage");
    const role = await this.get(actor, id);
    if (role.isBuiltIn) throw AppError.forbidden("Built-in roles cannot be deleted");
    if (role.userCount > 0) throw AppError.conflict("Move this role's users to another role first");
    await inTransaction(async (tx) => {
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "role", entityId: id, summary: `Deleted role ${role.name}` }, tx);
    });
  }
}
