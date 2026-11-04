import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../errors/AppError";

export interface AccessTokenPayload {
  sub: string;
  org: string;
  typ: "access";
}

export function signAccessToken(userId: string, organizationId: string): string {
  const payload: AccessTokenPayload = { sub: userId, org: organizationId, typ: "access" };
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtlSeconds, issuer: "showroompro" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret, { issuer: "showroompro" });
    if (typeof decoded !== "object" || decoded === null) throw new Error("bad token");
    const { sub, org, typ } = decoded as Partial<AccessTokenPayload>;
    if (typ !== "access" || typeof sub !== "string" || typeof org !== "string") throw new Error("bad token");
    return { sub, org, typ };
  } catch {
    throw AppError.unauthorised("Session expired or invalid — please sign in again");
  }
}

/** Opaque refresh token (random) — only its keyed hash is stored. */
export function newRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHmac("sha256", env.jwt.refreshSecret).update(token).digest("hex");
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
