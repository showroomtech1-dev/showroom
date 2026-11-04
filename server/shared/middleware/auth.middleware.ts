// Verifies the Bearer access token, then resolves the caller's live permissions from the database.
// If permission resolution fails it answers 503 — it never fails open.
import type { NextFunction, Request, Response } from "express";
import { resolveActor } from "../../modules/auth/services/actorResolver";
import { AppError } from "../errors/AppError";
import { verifyAccessToken } from "../utils/jwt";

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    next(AppError.unauthorised("Sign in to continue"));
    return;
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    next(err);
    return;
  }

  try {
    const actor = await resolveActor(payload.sub, payload.org);
    if (!actor) {
      next(AppError.unauthorised("Your account is inactive or no longer exists"));
      return;
    }
    req.user = { ...actor, ip: req.ip };
    next();
  } catch (err) {
    console.error("[auth] permission resolution failed", err);
    next(AppError.unavailable("Could not verify your permissions, please retry"));
  }
}
