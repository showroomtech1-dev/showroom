// Route guards + service checks. Every mounted route must carry exactly one guard from this file
// (enforced at boot by routeAudit). Services re-check with can()/assertPermission().
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { WILDCARD, type PermissionCode } from "../../modules/access/catalog/permissions.catalog";
import { AppError } from "../errors/AppError";
import type { Actor } from "../types/actor";

export type GuardKind = "permission" | "any" | "authenticated" | "public";

export interface GuardInfo {
  kind: GuardKind;
  codes: PermissionCode[];
  reason?: string;
}

export type GuardHandler = RequestHandler & { __guard: GuardInfo };

export function can(actor: Pick<Actor, "permissions"> | undefined | null, code: PermissionCode): boolean {
  if (!actor) return false;
  return actor.permissions.includes(WILDCARD) || actor.permissions.includes(code);
}

export function canAny(actor: Pick<Actor, "permissions"> | undefined | null, ...codes: PermissionCode[]): boolean {
  return codes.some((code) => can(actor, code));
}

export function assertPermission(actor: Actor, code: PermissionCode, message?: string): void {
  if (!can(actor, code)) throw AppError.forbidden(message);
}

function guard(info: GuardInfo, check: (req: Request) => boolean): GuardHandler {
  const handler = (req: Request, _res: Response, next: NextFunction): void => {
    if (info.kind !== "public" && !req.user) {
      next(AppError.unauthorised());
      return;
    }
    if (!check(req)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
  return Object.assign(handler, { __guard: info });
}

export function requirePermission(code: PermissionCode): GuardHandler {
  return guard({ kind: "permission", codes: [code] }, (req) => can(req.user, code));
}

export function requireAny(...codes: PermissionCode[]): GuardHandler {
  return guard({ kind: "any", codes }, (req) => canAny(req.user, ...codes));
}

/** Signed-in self-service (own profile, own notifications). */
export function requireAuthenticatedOnly(): GuardHandler {
  return guard({ kind: "authenticated", codes: [] }, (req) => Boolean(req.user));
}

/** Explicit opt-out for unauthenticated routes. */
export function publicRoute(reason: string): GuardHandler {
  return guard({ kind: "public", codes: [], reason }, () => true);
}

export function isGuard(fn: unknown): fn is GuardHandler {
  return typeof fn === "function" && "__guard" in fn;
}
