import { wrapCall } from "@/transport/http"
import type {
  OnlineUser,
  PlatformBusiness,
  PlatformLogin,
  PlatformOverview,
  PlatformUser,
} from "@/types/platform.types"

export const PlatformEndpoints = {
  overview: (params: { tz: string; days?: number }) =>
    wrapCall<PlatformOverview>("GET", "/api/v1/platform/overview", params),

  businesses: (params: Record<string, unknown>) =>
    wrapCall<PlatformBusiness[]>("GET", "/api/v1/platform/businesses", params),

  users: (params: Record<string, unknown>) => wrapCall<PlatformUser[]>("GET", "/api/v1/platform/users", params),

  online: () => wrapCall<OnlineUser[]>("GET", "/api/v1/platform/online"),

  logins: (limit = 30) => wrapCall<PlatformLogin[]>("GET", "/api/v1/platform/logins", { limit }),
}
