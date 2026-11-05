import { wrapCall } from "@/transport/http"
import type {
  ChangePasswordPayload,
  ForgotPasswordResult,
  GoogleSignInPayload,
  LoginPayload,
  LoginResult,
  RegisterPayload,
  ResetPasswordWithCodePayload,
  SessionData,
  TokenPair,
  UpdateProfilePayload,
} from "@/types/auth.types"

export const AuthEndpoints = {
  login: (payload: LoginPayload) =>
    wrapCall<LoginResult>("POST", "/api/v1/auth/login", payload as unknown as Record<string, unknown>),

  register: (payload: RegisterPayload) =>
    wrapCall<LoginResult>("POST", "/api/v1/auth/register", payload as unknown as Record<string, unknown>),

  googleSignIn: (payload: GoogleSignInPayload) =>
    wrapCall<LoginResult>("POST", "/api/v1/auth/google", payload as unknown as Record<string, unknown>),

  forgotPassword: (email: string) =>
    wrapCall<ForgotPasswordResult>("POST", "/api/v1/auth/forgot-password", { email }),

  resetPassword: (payload: ResetPasswordWithCodePayload) =>
    wrapCall<{ message: string }>("POST", "/api/v1/auth/reset-password", payload as unknown as Record<string, unknown>),

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
