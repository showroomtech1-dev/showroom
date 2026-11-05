import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { OrganizationEndpoints } from "@/endpoints/organization.endpoints"
import { ApiError } from "@/transport/http"
import type { BusinessProfile, OrganizationSettings } from "@/types/auth.types"

export const SETTINGS_KEY = "settings"
export const BRANCHES_KEY = "branches"
export const ROLES_KEY = "roles"
export const USERS_KEY = "users"
export const AUDIT_KEY = "audit-logs"
export const NOTIFICATIONS_KEY = "notifications"
export const TRASH_KEY = "trash"

export function useSettings() {
  return useQuery({
    queryKey: [SETTINGS_KEY],
    queryFn: async () => {
      const res = await OrganizationEndpoints.getSettings()
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
  })
}

export function useOrganization() {
  const q = useSettings()
  return { ...q, data: q.data?.settings }
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<OrganizationSettings>) => {
      const res = await OrganizationEndpoints.updateSettings(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SETTINGS_KEY] }),
  })
}

export function useUpdateBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<BusinessProfile>) => {
      const res = await OrganizationEndpoints.updateBusiness(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SETTINGS_KEY] }),
  })
}

export function useUploadLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const res = await OrganizationEndpoints.uploadLogo(file)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SETTINGS_KEY] }),
  })
}

export function useBranches(includeInactive = false) {
  return useQuery({
    queryKey: [BRANCHES_KEY, includeInactive],
    queryFn: async () => {
      const res = await OrganizationEndpoints.listBranches(includeInactive)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
  })
}

export function useSaveBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id ? await OrganizationEndpoints.updateBranch(id, payload) : await OrganizationEndpoints.createBranch(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [BRANCHES_KEY] }),
  })
}

export function useDeleteBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await OrganizationEndpoints.removeBranch(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [BRANCHES_KEY] }),
  })
}

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: [ROLES_KEY],
    queryFn: async () => {
      const res = await OrganizationEndpoints.listRoles()
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
    enabled,
  })
}

export function usePermissionsCatalog(enabled = true) {
  return useQuery({
    queryKey: [ROLES_KEY, "catalog"],
    queryFn: async () => {
      const res = await OrganizationEndpoints.listPermissions()
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
    enabled,
  })
}

export function useSaveRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: { name: string; description?: string; permissions: string[] } }) => {
      const res = id ? await OrganizationEndpoints.updateRole(id, payload) : await OrganizationEndpoints.createRole(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROLES_KEY] }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await OrganizationEndpoints.removeRole(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROLES_KEY] }),
  })
}

export function useUsers(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: [USERS_KEY, params],
    queryFn: async () => {
      const res = await OrganizationEndpoints.listUsers(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    enabled,
  })
}

export function useSaveUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id ? await OrganizationEndpoints.updateUser(id, payload) : await OrganizationEndpoints.createUser(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [USERS_KEY] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await OrganizationEndpoints.removeUser(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [USERS_KEY] }),
  })
}

export function useResetUserPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      password,
      mustChangePassword = true,
    }: {
      id: string
      password: string
      mustChangePassword?: boolean
    }) => {
      const res = await OrganizationEndpoints.resetUserPassword(id, { password, mustChangePassword })
      if (!res.success) throw new ApiError(res.message, res.statusCode, res.errors)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [USERS_KEY] }),
  })
}

export function useAuditLogs(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: [AUDIT_KEY, params],
    queryFn: async () => {
      const res = await OrganizationEndpoints.listAuditLogs(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    enabled,
  })
}

export function useNotifications(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, params],
    queryFn: async () => {
      const res = await OrganizationEndpoints.listNotifications(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, "unread-count"],
    queryFn: async () => {
      const res = await OrganizationEndpoints.unreadNotificationCount()
      return res.success && res.data ? res.data.unread : 0
    },
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id?: string) => {
      const res = id ? await OrganizationEndpoints.markNotificationRead(id) : await OrganizationEndpoints.markAllNotificationsRead()
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] }),
  })
}

export function useTrash(type: string, enabled = true) {
  return useQuery({
    queryKey: [TRASH_KEY, type],
    queryFn: async () => {
      const res = await OrganizationEndpoints.listTrash(type, 100)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
    enabled: Boolean(type) && enabled,
  })
}

export function useRestoreTrash() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const res = await OrganizationEndpoints.restoreTrash(type, id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TRASH_KEY] }),
  })
}
