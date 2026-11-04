import { env } from "../../../config/env";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { PermissionCache } from "../../../shared/access/permissionCache";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { hashRefreshToken, newRefreshToken, signAccessToken } from "../../../shared/utils/jwt";
import { dummyHash, hashPassword, verifyPassword } from "../../../shared/utils/password";
import { AuditService } from "../../audit/services/audit.service";
import { OrganizationService } from "../../organization/services/organization.service";
import { UserRepository } from "../../user/repositories/user.repository";
import type { ClientContext, LoginResultDTO, SessionDTO, TokenPairDTO } from "../dto/auth.dto";
import { RefreshTokenRepository } from "../repositories/refreshToken.repository";
import type { ChangePasswordInput, LoginInput, UpdateProfileInput } from "../validators/auth.schema";
import { resolveActor } from "./actorResolver";


export class AuthService {
  static Instance = new AuthService();
  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly tokens = RefreshTokenRepository.Instance,
    private readonly organizations = OrganizationService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async login(data: LoginInput, client: ClientContext): Promise<LoginResultDTO> {
    const creds = await this.users.findCredentialsByEmail(data.email);
    const ok = await verifyPassword(data.password, creds?.passwordHash ?? dummyHash());
    if (!creds || !ok) throw AppError.unauthorised("Incorrect email or password");
    if (!creds.isActive) throw AppError.forbidden("Your account has been deactivated. Contact the business owner.");

    const actor = await resolveActor(creds.id, creds.organizationId);
    if (!actor) throw AppError.unauthorised("Incorrect email or password");

    const tokens = await this.issueTokens(actor.id, actor.organizationId, client);
    await this.users.touchLogin(actor.id);
    this.audit
      .record({ ...actor, ip: client.ip ?? undefined }, actor.organizationId, { action: "login", entityType: "user", entityId: actor.id, summary: `${actor.name} signed in` })
      .catch((err) => console.error("[audit] login log failed", err));
    return { ...(await this.session(actor)), tokens };
  }

  async refresh(refreshToken: string, client: ClientContext): Promise<TokenPairDTO> {
    const hash = hashRefreshToken(refreshToken);
    return inTransaction(async (tx) => {
      const row = await this.tokens.findByHashForUpdate(hash, tx);
      if (!row) throw AppError.unauthorised("Session expired — please sign in again");
      if (row.revokedAt) {
        // A revoked token being replayed means it may have been stolen: end every session for this user.
        await this.tokens.revokeAllForUser(row.userId, tx);
        throw AppError.unauthorised("Session expired — please sign in again");
      }
      if (row.expiresAt.getTime() < Date.now()) throw AppError.unauthorised("Session expired — please sign in again");

      const actorRow = await this.users.findActor(row.userId);
      if (!actorRow || !actorRow.isActive) throw AppError.unauthorised("Your account is inactive");

      await this.tokens.revoke(row.id, tx);
      return this.issueTokens(actorRow.id, actorRow.organizationId, client, tx);
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeByHash(hashRefreshToken(refreshToken));
  }

  async session(actor: Actor): Promise<SessionDTO> {
    const user = await this.users.findById(actor.organizationId, actor.id);
    if (!user) throw AppError.unauthorised();
    const { business, settings } = await this.organizations.getBusiness(actor);
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        branchId: user.branchId,
        branchName: user.branchName,
        roleId: user.roleId,
        roleKey: user.roleKey,
        roleName: user.roleName,
        mustChangePassword: user.mustChangePassword,
      },
      permissions: actor.permissions,
      business,
      settings,
    };
  }

  async updateProfile(actor: Actor, data: UpdateProfileInput): Promise<SessionDTO> {
    await this.users.update(actor.organizationId, actor.id, data);
    PermissionCache.invalidateUser(actor.id);
    const fresh = (await resolveActor(actor.id, actor.organizationId)) ?? actor;
    return this.session(fresh);
  }

  async changePassword(actor: Actor, data: ChangePasswordInput, client: ClientContext): Promise<TokenPairDTO> {
    const hash = await this.users.findPasswordHash(actor.id);
    if (!hash || !(await verifyPassword(data.currentPassword, hash))) {
      throw AppError.badRequest("Your current password is incorrect");
    }
    if (data.currentPassword === data.newPassword) throw AppError.badRequest("Choose a new password you haven't used here");
    const passwordHash = await hashPassword(data.newPassword);
    return inTransaction(async (tx) => {
      await this.users.update(actor.organizationId, actor.id, { passwordHash, mustChangePassword: false }, tx);
      await this.tokens.revokeAllForUser(actor.id, tx);
      await this.audit.log(actor, { action: "update", entityType: "user", entityId: actor.id, summary: "Changed own password" }, tx);
      return this.issueTokens(actor.id, actor.organizationId, client, tx);
    });
  }

  private async issueTokens(
    userId: string,
    organizationId: string,
    client: ClientContext,
    tx?: Parameters<RefreshTokenRepository["create"]>[1]
  ): Promise<TokenPairDTO> {
    const refreshToken = newRefreshToken();
    await this.tokens.create(
      {
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000),
        userAgent: client.userAgent?.slice(0, 255) ?? null,
        ip: client.ip,
      },
      tx
    );
    return { accessToken: signAccessToken(userId, organizationId), refreshToken, expiresIn: env.jwt.accessTtlSeconds };
  }
}
