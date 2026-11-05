import { z } from "zod";
import { pageQuery, uuid } from "../../../shared/validation/common";

/** IANA timezone of the viewer, so "today" and the daily chart match their clock. */
const timezone = z
  .string()
  .trim()
  .max(64)
  .default("UTC")
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone");

export const overviewSchema = z.object({
  query: z.object({ tz: timezone, days: z.coerce.number().int().min(7).max(90).default(30) }),
});

export const businessListSchema = z.object({
  query: z.object({
    ...pageQuery,
    sort: z.enum(["newest", "oldest", "name", "lastActive", "sales"]).default("newest"),
    status: z.enum(["online", "active7d", "dormant", "neverSold"]).optional(),
  }),
});

export const userListSchema = z.object({
  query: z.object({
    ...pageQuery,
    sort: z.enum(["recent", "lastSeen", "lastLogin", "name"]).default("recent"),
    status: z.enum(["online", "active24h", "active7d", "neverLoggedIn", "deactivated", "new7d"]).optional(),
    organizationId: uuid.optional(),
  }),
});

export const loginListSchema = z.object({
  query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
});
