import { wrapCall } from "@/transport/http"
import type {
  ChangePasswordPayload,
  LoginPayload,
  LoginResult,
  SessionData,
  TokenPair,
  UpdateProfilePayload,
} from "@/types/auth.types"

export const AuthEndpoints = {
  login: (payload: LoginPayload) =>
    wrapCall<LoginResult>("POST", "/api/v1/auth/login", payload as unknown as Record<string, unknown>),

  refresh: (refreshToken: string) =>
    wrapCall<TokenPair>("POST", "/api/v1/auth/refresh", { refreshToken }),

  logout: (refreshToken: string) =>
    wrapCall<null>("POST", "/api/v1/auth/logout", { refreshToken }),

  me: () =>
    wrapCall<SessionData>("GET", "/api/v1/auth/me"),

  updateMe: (payload: UpdateProfilePayload) =>
    wrapCall<SessionData>("PATCH", "/api/v1/auth/me", payload as Record<string, unknown>),

  changePassword: (payload: ChangePasswordPayload) =>
    wrapCall<TokenPair>("POST", "/api/v1/auth/change-password", payload as unknown as Record<string, unknown>),
}
