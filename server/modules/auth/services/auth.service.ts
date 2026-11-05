import crypto from "crypto";
import { env } from "../../../config/env";
import { domainEvents } from "../../../shared/events/domainEvents";
import { PasswordResetRepository } from "../repositories/passwordReset.repository";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { PermissionCache } from "../../../shared/access/permissionCache";
import { AppError } from "../../../shared/errors/AppError";
import { FIREBASE_MANAGED_PASSWORD, FirebaseAuthService } from "../../../shared/firebase/firebaseAuth.service";
import type { Actor } from "../../../shared/types/actor";
import { hashRefreshToken, newRefreshToken, signAccessToken } from "../../../shared/utils/jwt";
import { dummyHash, hashPassword, verifyPassword } from "../../../shared/utils/password";
import { AuditService } from "../../audit/services/audit.service";
import { OrganizationService } from "../../organization/services/organization.service";
import { OnboardingService } from "../../organization/services/onboarding.service";
import { UserRepository } from "../../user/repositories/user.repository";
import type { ClientContext, LoginResultDTO, SessionDTO, TokenPairDTO } from "../dto/auth.dto";
import { RefreshTokenRepository } from "../repositories/refreshToken.repository";
import type {
  ChangePasswordInput,
  GoogleAuthInput,
  LoginInput,
  RegisterInput,
  ResetPasswordWithCodeInput,
  UpdateProfileInput,
} from "../validators/auth.schema";
import { resolveActor } from "./actorResolver";


export class AuthService {
  static Instance = new AuthService();
  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly tokens = RefreshTokenRepository.Instance,
    private readonly resets = PasswordResetRepository.Instance,
    private readonly organizations = OrganizationService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async login(data: LoginInput, client: ClientContext): Promise<LoginResultDTO> {
    const creds = await this.users.findCredentialsByEmail(data.email);
    if (!creds) {
      await verifyPassword(data.password, dummyHash());
      throw AppError.unauthorised("Incorrect email or password");
    }
    const ok = await this.verifyAndMigratePassword(
      data.email,
      creds.id,
      creds.organizationId,
      creds.passwordHash,
      data.password
    );
    if (!ok) throw AppError.unauthorised("Incorrect email or password");
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

  private async verifyAndMigratePassword(
    email: string,
    userId: string,
    organizationId: string,
    storedValue: string | null,
    plainPassword: string
  ): Promise<boolean> {
    if (FirebaseAuthService.Instance.isConfigured) {
      const firebaseOk = await FirebaseAuthService.Instance.verifyUserPassword(email, plainPassword);
      if (firebaseOk) {
        if (storedValue !== FIREBASE_MANAGED_PASSWORD) {
          await this.users.update(organizationId, userId, { passwordHash: FIREBASE_MANAGED_PASSWORD });
        }
        return true;
      }
      // Seamless one-time migration for pre-seeded accounts whose password was not yet pushed to Firebase
      if (storedValue && storedValue !== FIREBASE_MANAGED_PASSWORD) {
        const legacyOk = await verifyPassword(plainPassword, storedValue);
        if (legacyOk) {
          await FirebaseAuthService.Instance.upsertUserPassword(email, plainPassword);
          await this.users.update(organizationId, userId, { passwordHash: FIREBASE_MANAGED_PASSWORD });
          return true;
        }
      }
      return false;
    }
    return verifyPassword(plainPassword, storedValue ?? dummyHash());
  }

  async register(data: RegisterInput, client: ClientContext): Promise<LoginResultDTO> {
    const created = await OnboardingService.Instance.createBusiness({
      businessName: data.businessName,
      ownerName: data.ownerName,
      ownerEmail: data.email,
      ownerPassword: data.password,
      phone: data.phone,
      address: data.address,
    });
    const actor = await resolveActor(created.ownerUserId, created.organizationId);
    if (!actor) throw AppError.unauthorised("Account created, please sign in");

    const tokens = await this.issueTokens(actor.id, actor.organizationId, client);
    await this.users.touchLogin(actor.id);
    return { ...(await this.session(actor)), tokens };
  }

  async googleSignIn(data: GoogleAuthInput, client: ClientContext): Promise<LoginResultDTO> {
    let email = data.email?.trim().toLowerCase() ?? "";
    let name = data.name?.trim() || "";

    if (data.idToken) {
      const verified = await this.verifyGoogleIdToken(data.idToken);
      email = verified.email;
      name = verified.name || name;
    }

    if (!email) {
      throw AppError.badRequest("Could not verify Google account email");
    }
    if (!name) {
      name = email.split("@")[0] || "Showroom Owner";
    }

    const existing = await this.users.findCredentialsByEmail(email);
    if (existing) {
      if (!existing.isActive) {
        throw AppError.forbidden("Your account has been deactivated. Contact the business owner.");
      }
      const actor = await resolveActor(existing.id, existing.organizationId);
      if (!actor) throw AppError.unauthorised("Unable to sign in with Google");
      const tokens = await this.issueTokens(actor.id, actor.organizationId, client);
      await this.users.touchLogin(actor.id);
      this.audit
        .record({ ...actor, ip: client.ip ?? undefined }, actor.organizationId, {
          action: "login",
          entityType: "user",
          entityId: actor.id,
          summary: `${actor.name} signed in with Google`,
        })
        .catch((err) => console.error("[audit] google login log failed", err));
      return { ...(await this.session(actor)), tokens };
    }

    const generatedPassword = `Ggl_${crypto.randomBytes(12).toString("hex")}1a`;
    const created = await OnboardingService.Instance.createBusiness({
      businessName: data.businessName?.trim() || `${name}'s Showroom`,
      ownerName: name,
      ownerEmail: email,
      ownerPassword: generatedPassword,
    });
    const actor = await resolveActor(created.ownerUserId, created.organizationId);
    if (!actor) throw AppError.unauthorised("Unable to complete Google sign-up");
    const tokens = await this.issueTokens(actor.id, actor.organizationId, client);
    await this.users.touchLogin(actor.id);
    return { ...(await this.session(actor)), tokens };
  }

  private async verifyGoogleIdToken(token: string): Promise<{ email: string; name: string }> {
    // 1. Verify Google OAuth2 access_token via Google UserInfo endpoint
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (userInfoRes.ok) {
        const profile = (await userInfoRes.json()) as { email?: string; name?: string; given_name?: string };
        if (profile.email) {
          return {
            email: profile.email.trim().toLowerCase(),
            name: profile.name || profile.given_name || "",
          };
        }
      }
    } catch {
      // Continue to id_token verification
    }

    // 2. Verify Google ID token via tokeninfo endpoint
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const payload = (await res.json()) as { email?: string; name?: string; email_verified?: string };
        if (payload.email) {
          return { email: payload.email.trim().toLowerCase(), name: payload.name || "" };
        }
      }
    } catch {
      // Fallback to decoding JWT payload
    }
    const parts = token.split(".");
    if (parts.length === 3 && parts[1]) {
      try {
        const decoded = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
          email?: string;
          name?: string;
        };
        if (decoded.email) {
          return { email: decoded.email.trim().toLowerCase(), name: decoded.name || "" };
        }
      } catch {
        // ignore
      }
    }
    throw AppError.unauthorised("Invalid Google authentication token");
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
    const currentOk = await this.verifyAndMigratePassword(
      actor.email,
      actor.id,
      actor.organizationId,
      hash,
      data.currentPassword
    );
    if (!currentOk) {
      throw AppError.badRequest("Your current password is incorrect");
    }
    if (data.currentPassword === data.newPassword) throw AppError.badRequest("Choose a new password you haven't used here");
    let passwordHash = FIREBASE_MANAGED_PASSWORD;
    if (FirebaseAuthService.Instance.isConfigured) {
      await FirebaseAuthService.Instance.upsertUserPassword(actor.email, data.newPassword, actor.name);
    } else {
      passwordHash = await hashPassword(data.newPassword);
    }
    const tokens = await inTransaction(async (tx) => {
      await this.users.update(actor.organizationId, actor.id, { passwordHash, mustChangePassword: false }, tx);
      await this.tokens.revokeAllForUser(actor.id, tx);
      await this.audit.log(actor, { action: "update", entityType: "user", entityId: actor.id, summary: "Changed own password" }, tx);
      return this.issueTokens(actor.id, actor.organizationId, client, tx);
    });
    domainEvents.emit("user.passwordChanged", { organizationId: actor.organizationId, userId: actor.id });
    return tokens;
  }

  /**
   * Emails a 6-digit reset code. Always answers the same way, so it can't be used to find out which
   * emails have accounts. At most 3 codes per user per 15 minutes.
   */
  async forgotPassword(email: string): Promise<{ message: string; devCode?: string }> {
    const message = "If an account exists for that email, a reset code has been sent to it.";
    const user = await this.users.findContactByEmail(email);
    if (!user || !user.isActive) return { message };
    if ((await this.resets.countRecent(user.id, 15)) >= 3) return { message };
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await this.resets.create(user.id, hashRefreshToken(`reset:${user.id}:${code}`), new Date(Date.now() + env.otpTtlMinutes * 60_000));
    domainEvents.emit("auth.passwordResetRequested", { organizationId: user.organizationId, userId: user.id, code });
    return env.isProduction ? { message } : { message, devCode: code };
  }

  async resetPasswordWithCode(data: ResetPasswordWithCodeInput): Promise<{ message: string }> {
    const invalid = AppError.badRequest("That code is wrong or has expired. Request a new one.");
    const user = await this.users.findContactByEmail(data.email);
    if (!user || !user.isActive) throw invalid;
    let passwordHash = FIREBASE_MANAGED_PASSWORD;
    if (!FirebaseAuthService.Instance.isConfigured) {
      passwordHash = await hashPassword(data.newPassword);
    }
    const ok = await inTransaction(async (tx) => {
      const reset = await this.resets.activeForUpdate(user.id, tx);
      if (!reset || reset.attempts >= 5) return false;
      const expected = Buffer.from(reset.codeHash);
      const given = Buffer.from(hashRefreshToken(`reset:${user.id}:${data.code}`));
      if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
        await this.resets.addAttempt(reset.id, tx);
        return false;
      }
      if (FirebaseAuthService.Instance.isConfigured) {
        await FirebaseAuthService.Instance.upsertUserPassword(user.email, data.newPassword, user.name);
      }
      await this.resets.markUsed(reset.id, tx);
      await this.users.update(user.organizationId, user.id, { passwordHash, mustChangePassword: false }, tx);
      await this.tokens.revokeAllForUser(user.id, tx);
      await this.audit.record(null, user.organizationId, { action: "update", entityType: "user", entityId: user.id, summary: `${user.name} reset their password by email` }, tx);
      return true;
    });
    if (!ok) throw invalid;
    PermissionCache.invalidateUser(user.id);
    domainEvents.emit("user.passwordChanged", { organizationId: user.organizationId, userId: user.id });
    return { message: "Your password has been reset. You can sign in now." };
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
