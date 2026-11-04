import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { ApiResponse } from "../response/apiResponse";

const tooMany = (_req: Request, res: Response): void => {
  res.status(429).json(ApiResponse.error("Too many requests, please try again shortly", 429));
};

/** Mounted on /api/v1 globally. */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: tooMany,
});

/** Login, refresh, password change. */
export const authRateLimiter = Object.assign(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: tooMany,
  }),
  { __rateLimited: true as const }
);
