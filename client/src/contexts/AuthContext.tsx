import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { can as checkCan, canAny as checkCanAny } from "@/lib/can"
import { tokenStorage } from "@/lib/storage"
import type {
  BusinessProfile,
  GoogleSignInPayload,
  LoginPayload,
  LoginResult,
  OrganizationSettings,
  RegisterPayload,
  SessionData,
  SessionUser,
} from "@/types/auth.types"
import type { Role } from "@/types/organization.types"
import { ApiError } from "@/transport/http"

interface AuthContextValue {
  user: SessionUser | null
  actualUser: SessionUser | null
  isAuthenticated: boolean
  isLoading: boolean
  loading: boolean
  permissions: readonly string[]
  business: BusinessProfile | null
  settings: OrganizationSettings | null
  currencySymbol: string
  selectedBranchId: string
  activeBranchId: string
  setSelectedBranchId: (branchId: string) => void
  previewRole: Role | null
  startPreview: (role: Role) => void
  startRolePreview: (role: { id: string; name: string; permissions: string[] }) => void
  exitPreview: () => void
  can: (code: string) => boolean
  canAny: (codes: readonly string[]) => boolean
  login: (payload: LoginPayload) => Promise<SessionData>
  register: (payload: RegisterPayload) => Promise<SessionData>
  googleSignIn: (payload: GoogleSignInPayload) => Promise<SessionData>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState<boolean>(() => Boolean(tokenStorage.getAccess()))
  const [previewRole, setPreviewRole] = useState<Role | null>(null)
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>(() => {
    try {
      return localStorage.getItem("showroompro_branch") || ""
    } catch {
      return ""
    }
  })

  const setSelectedBranchId = useCallback((branchId: string) => {
    setSelectedBranchIdState(branchId)
    try {
      if (branchId) localStorage.setItem("showroompro_branch", branchId)
      else localStorage.removeItem("showroompro_branch")
    } catch {
      // ignore
    }
  }, [])

  const refreshSession = useCallback(async () => {
    if (!tokenStorage.getAccess()) {
      setSession(null)
      setLoading(false)
      return
    }
    const res = await AuthEndpoints.me()
    if (res.success && res.data) {
      setSession(res.data)
    } else {
      tokenStorage.clear()
      setSession(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  const applyAuthResult = useCallback(
    (data: LoginResult): SessionData => {
      tokenStorage.set(data.tokens.accessToken, data.tokens.refreshToken)
      const { tokens: _t, ...sessionData } = data
      setSession(sessionData)
      setPreviewRole(null)
      if (sessionData.user.branchId && !checkCan(sessionData.permissions, "branch.all")) {
        setSelectedBranchId(sessionData.user.branchId)
      }
      return sessionData
    },
    [setSelectedBranchId]
  )

  const login = useCallback(
    async (payload: LoginPayload): Promise<SessionData> => {
      const res = await AuthEndpoints.login(payload)
      if (!res.success || !res.data) {
        throw new ApiError(res.message || "Unable to sign in", res.statusCode, res.errors)
      }
      return applyAuthResult(res.data)
    },
    [applyAuthResult]
  )

  const register = useCallback(
    async (payload: RegisterPayload): Promise<SessionData> => {
      const res = await AuthEndpoints.register(payload)
      if (!res.success || !res.data) {
        throw new ApiError(res.message || "Unable to create account", res.statusCode, res.errors)
      }
      return applyAuthResult(res.data)
    },
    [applyAuthResult]
  )

  const googleSignIn = useCallback(
    async (payload: GoogleSignInPayload): Promise<SessionData> => {
      const res = await AuthEndpoints.googleSignIn(payload)
      if (!res.success || !res.data) {
        throw new ApiError(res.message || "Unable to sign in with Google", res.statusCode, res.errors)
      }
      return applyAuthResult(res.data)
    },
    [applyAuthResult]
  )

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefresh()
    tokenStorage.clear()
    setSession(null)
    setPreviewRole(null)
    qc.clear()
    // Wipe business data the service worker cached for offline use.
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_API_CACHE" })
    if (refresh) {
      await AuthEndpoints.logout(refresh).catch(() => null)
    }
  }, [qc])

  const activePermissions = useMemo(() => {
    if (previewRole) return previewRole.permissions
    return session?.permissions ?? []
  }, [previewRole, session])

  const effectiveUser = useMemo<SessionUser | null>(() => {
    if (!session?.user) return null
    if (!previewRole) return session.user
    return {
      ...session.user,
      roleId: previewRole.id,
      roleKey: previewRole.key,
      roleName: previewRole.name,
    }
  }, [session, previewRole])

  const can = useCallback((code: string) => checkCan(activePermissions, code), [activePermissions])
  const canAny = useCallback((codes: readonly string[]) => checkCanAny(activePermissions, codes), [activePermissions])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: effectiveUser,
      actualUser: session?.user ?? null,
      isAuthenticated: Boolean(effectiveUser),
      isLoading: loading,
      loading,
      permissions: activePermissions,
      business: session?.business ?? null,
      settings: session?.settings ?? null,
      currencySymbol: session?.settings?.currencySymbol || "₦",
      selectedBranchId,
      activeBranchId: selectedBranchId,
      setSelectedBranchId,
      previewRole,
      startPreview: (role: Role) => setPreviewRole(role),
      startRolePreview: (role) =>
        setPreviewRole({
          id: role.id,
          key: role.id,
          name: role.name,
          description: null,
          permissions: role.permissions,
          isBuiltIn: false,
          isLocked: false,
          userCount: 0,
        }),
      exitPreview: () => setPreviewRole(null),
      can,
      canAny,
      login,
      register,
      googleSignIn,
      logout,
      refreshSession,
    }),
    [
      effectiveUser,
      session,
      activePermissions,
      selectedBranchId,
      setSelectedBranchId,
      loading,
      previewRole,
      can,
      canAny,
      login,
      register,
      googleSignIn,
      logout,
      refreshSession,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
