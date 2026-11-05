// One origin rule for the REST API and the Socket.io server.
import { env } from "../../config/env";

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || env.corsOrigins.includes(origin) || origin.endsWith(".vercel.app") || !env.isProduction;
}
