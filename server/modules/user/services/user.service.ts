import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { PermissionCache } from "../../../shared/access/permissionCache";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { hashPassword } from "../../../shared/utils/password";
import { RoleService } from "../../access/services/role.service";
import { AuditService } from "../../audit/services/audit.service";
import { RefreshTokenRepository } from "../../auth/repositories/refreshToken.repository";
import { BranchService } from "../../organization/services/branch.service";
import type { UserDTO, UserLookupDTO } from "../dto/user.dto";
import { UserRepository } from "../repositories/user.repository";
import type { CreateUserInput, ListUsersQuery, ResetPasswordInput, UpdateUserInput } from "../validators/user.schema";

export class UserService {
  static Instance = new UserService();
  private constructor(
    private readonly repo = UserRepository.Instance,
    private readonly roles = RoleService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly tokens = RefreshTokenRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async list(actor: Actor, query: ListUsersQuery) {
    assertPermission(actor, "user.manage");
    return this.repo.list(actor.organizationId, query);
  }

  /** Lightweight staff list for filters and pickers (sales by staff, commissions…). */
  async lookup(actor: Actor, branchId?: string): Promise<UserLookupDTO[]> {
    return this.repo.lookup(actor.organizationId, readBranchScope(actor, branchId));
  }

  async get(actor: Actor, id: string): Promise<UserDTO> {
    const user = await this.repo.findById(actor.organizationId, id);
    if (!user) throw AppError.notFound("User not found");
    return user;
  }

  async create(actor: Actor, data: CreateUserInput): Promise<UserDTO> {
    assertPermission(actor, "user.manage");
    if (await this.repo.existsByEmail(data.email)) throw AppError.conflict("A user with this email already exists");
    await this.roles.get(actor, data.roleId);
    if (data.branchId) await this.branches.get(actor, data.branchId);
    const passwordHash = await hashPassword(data.password);
    const id = await inTransaction(async (tx) => {
      const userId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          branchId: data.branchId ?? null,
          roleId: data.roleId,
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          passwordHash,
          isActive: true,
          mustChangePassword: data.mustChangePassword,
        },
        tx
      );
      await this.audit.log(actor, { action: "create", entityType: "user", entityId: userId, summary: `Created user ${data.name} (${data.email})` }, tx);
      return userId;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateUserInput): Promise<UserDTO> {
    assertPermission(actor, "user.manage");
    const before = await this.get(actor, id);
    if (id === actor.id && (data.isActive === false || (data.roleId && data.roleId !== before.roleId))) {
      throw AppError.badRequest("You cannot deactivate yourself or change your own role");
    }
    if (data.roleId) await this.roles.get(actor, data.roleId);
    if (data.branchId) await this.branches.get(actor, data.branchId);
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, data, tx);
      if (data.isActive === false) await this.tokens.revokeAllForUser(id, tx);
      await this.audit.log(actor, { action: "update", entityType: "user", entityId: id, summary: `Updated user ${before.name}`, before: { ...before }, after: data }, tx);
    });
    PermissionCache.invalidateUser(id);
    return this.get(actor, id);
  }

  async resetPassword(actor: Actor, id: string, data: ResetPasswordInput): Promise<void> {
    assertPermission(actor, "user.manage");
    const user = await this.get(actor, id);
    const passwordHash = await hashPassword(data.password);
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, { passwordHash, mustChangePassword: data.mustChangePassword }, tx);
      await this.tokens.revokeAllForUser(id, tx);
      await this.audit.log(actor, { action: "update", entityType: "user", entityId: id, summary: `Reset password for ${user.name}` }, tx);
    });
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "user.manage");
    if (id === actor.id) throw AppError.badRequest("You cannot delete your own account");
    const user = await this.get(actor, id);
    if (user.roleKey === "owner" && (await this.repo.countActiveWithRole(actor.organizationId, user.roleId)) <= 1) {
      throw AppError.badRequest("The business must keep at least one active owner");
    }
    await inTransaction(async (tx) => {
      await this.tokens.revokeAllForUser(id, tx);
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "user", entityId: id, summary: `Deleted user ${user.name}`, before: { ...user } }, tx);
    });
    PermissionCache.invalidateUser(id);
  }
}
