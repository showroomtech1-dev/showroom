// Builds the Actor for an authenticated request from the DATABASE (never from the token alone), so
// deactivating a user or editing a role takes effect immediately (cache TTL ≤ 60 s, invalidated on writes).
import { PermissionCache } from "../../../shared/access/permissionCache";
import type { Actor } from "../../../shared/types/actor";
import { UserRepository } from "../../user/repositories/user.repository";

export async function resolveActor(userId: string, organizationId: string): Promise<Actor | null> {
  const cached = PermissionCache.get(userId);
  if (cached) return cached.organizationId === organizationId ? cached : null;

  const row = await UserRepository.Instance.findActor(userId);
  if (!row || !row.isActive || row.organizationId !== organizationId) return null;

  const actor: Actor = {
    id: row.id,
    organizationId: row.organizationId,
    branchId: row.branchId,
    roleId: row.roleId,
    roleKey: row.roleKey,
    roleName: row.roleName,
    name: row.name,
    email: row.email,
    permissions: Object.freeze([...(row.permissions ?? [])]),
  };
  PermissionCache.set(actor);
  return actor;
}
