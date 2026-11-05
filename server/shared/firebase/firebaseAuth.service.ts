import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../errors/AppError";

/**
 * Stored in PostgreSQL `users.password_hash` when credentials are managed by Firebase Authentication.
 * Ensures no user password (or bcrypt hash of a password) is ever stored in the database.
 */
export const FIREBASE_MANAGED_PASSWORD = "firebase:managed";

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

export class FirebaseAuthService {
  static Instance = new FirebaseAuthService();
  private cachedAccessToken: CachedToken | null = null;
  private cachedWebApiKey: string | null = null;

  private constructor() {}

  get isConfigured(): boolean {
    return env.firebase.configured;
  }

  /**
   * Obtains a short-lived Google OAuth2 Bearer token for the Firebase Admin service account.
   */
  private async getAdminAccessToken(): Promise<string> {
    if (!this.isConfigured) {
      throw AppError.badRequest("Firebase Authentication is not configured on the server");
    }
    if (this.cachedAccessToken && this.cachedAccessToken.expiresAtMs > Date.now() + 60_000) {
      return this.cachedAccessToken.accessToken;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const keyObject = crypto.createPrivateKey({
      key: env.firebase.privateKey,
      format: "pem",
    });
    const assertion = jwt.sign(
      {
        iss: env.firebase.clientEmail,
        sub: env.firebase.clientEmail,
        aud: "https://oauth2.googleapis.com/token",
        iat: nowSec,
        exp: nowSec + 3600,
        scope: [
          "https://www.googleapis.com/auth/identitytoolkit",
          "https://www.googleapis.com/auth/cloud-platform",
          "https://www.googleapis.com/auth/userinfo.email",
        ].join(" "),
      },
      keyObject,
      { algorithm: "RS256" }
    );

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[firebase] Failed to obtain service account access token:", errText);
      throw AppError.badRequest("Could not connect to Firebase Authentication");
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.cachedAccessToken = {
      accessToken: data.access_token,
      expiresAtMs: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  /**
   * Discovers the Firebase project's Web API key via the Identity Toolkit Admin Config endpoint
   * (or uses FIREBASE_API_KEY if set in .env).
   */
  private async getWebApiKey(): Promise<string> {
    if (env.firebase.webApiKey) return env.firebase.webApiKey;
    if (this.cachedWebApiKey) return this.cachedWebApiKey;

    const token = await this.getAdminAccessToken();
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${env.firebase.projectId}/config`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.ok) {
      const cfg = (await res.json()) as { client?: { apiKey?: string } };
      if (cfg.client?.apiKey) {
        this.cachedWebApiKey = cfg.client.apiKey;
        return this.cachedWebApiKey;
      }
    }

    throw AppError.badRequest("Unable to resolve Firebase Web API key for password verification");
  }

  /**
   * Looks up a Firebase Auth user by email and returns their `localId` (uid) if found.
   */
  async findUidByEmail(email: string): Promise<string | null> {
    const token = await this.getAdminAccessToken();
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${env.firebase.projectId}/accounts:lookup`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: [email.trim().toLowerCase()] }),
      }
    );

    if (!res.ok) return null;
    const data = (await res.json()) as { users?: Array<{ localId: string; email: string }> };
    return data.users?.[0]?.localId ?? null;
  }

  /**
   * Creates or updates the user's password in Firebase Authentication so the password
   * is stored exclusively in Firebase and never in PostgreSQL.
   */
  async upsertUserPassword(email: string, password: string, displayName?: string): Promise<string> {
    const normalizedEmail = email.trim().toLowerCase();
    const token = await this.getAdminAccessToken();
    const existingUid = await this.findUidByEmail(normalizedEmail);

    if (existingUid) {
      const updateRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${env.firebase.projectId}/accounts:update`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            localId: existingUid,
            password,
            ...(displayName ? { displayName } : {}),
            emailVerified: true,
          }),
        }
      );

      if (!updateRes.ok) {
        const err = await updateRes.text().catch(() => "");
        console.error("[firebase] Failed to update user password:", err);
        throw AppError.badRequest("Failed to save password in Firebase Authentication");
      }
      return existingUid;
    }

    const createRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${env.firebase.projectId}/accounts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          ...(displayName ? { displayName } : {}),
          emailVerified: true,
        }),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.text().catch(() => "");
      console.error("[firebase] Failed to create user in Firebase:", err);
      throw AppError.badRequest("Failed to create user credentials in Firebase Authentication");
    }

    const created = (await createRes.json()) as { localId: string };
    return created.localId;
  }

  /**
   * Verifies an email + password against Firebase Authentication (`accounts:signInWithPassword`).
   */
  async verifyUserPassword(email: string, password: string): Promise<boolean> {
    try {
      const apiKey = await this.getWebApiKey();
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            returnSecureToken: true,
          }),
        }
      );
      return res.ok;
    } catch (err) {
      console.error("[firebase] Password verification error:", err);
      return false;
    }
  }
}
