import { downloadFile, uploadWithFields, wrapCall } from "@/transport/http"
import type {
  AuditLog,
  Branch,
  BusinessSettingsBundle,
  NotificationItem,
  PermissionDefinition,
  Role,
  TrashItem,
  UserLookup,
  UserRecord,
} from "@/types/organization.types"
import type { BusinessProfile, OrganizationSettings } from "@/types/auth.types"

export const OrganizationEndpoints = {
  getSettings: () =>
    wrapCall<BusinessSettingsBundle>("GET", "/api/v1/settings"),

  updateSettings: (payload: Partial<OrganizationSettings>) =>
    wrapCall<OrganizationSettings>("PATCH", "/api/v1/settings", payload as Record<string, unknown>),

  updateBusiness: (payload: Partial<BusinessProfile>) =>
    wrapCall<BusinessProfile>("PATCH", "/api/v1/settings/business", payload as Record<string, unknown>),

  uploadLogo: (file: File) =>
    uploadWithFields<BusinessProfile>("/api/v1/settings/logo", file, {}, "logo"),

  removeLogo: () =>
    wrapCall<BusinessProfile>("DELETE", "/api/v1/settings/logo"),

  listBranches: (includeInactive = false) =>
    wrapCall<Branch[]>("GET", "/api/v1/branches", { includeInactive }),

  createBranch: (payload: Record<string, unknown>) =>
    wrapCall<Branch>("POST", "/api/v1/branches", payload),

  updateBranch: (id: string, payload: Record<string, unknown>) =>
    wrapCall<Branch>("PATCH", `/api/v1/branches/${id}`, payload),

  removeBranch: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/branches/${id}`),

  listPermissions: () =>
    wrapCall<PermissionDefinition[]>("GET", "/api/v1/roles/permissions"),

  listRoles: () =>
    wrapCall<Role[]>("GET", "/api/v1/roles"),

  createRole: (payload: { name: string; description?: string; permissions: string[] }) =>
    wrapCall<Role>("POST", "/api/v1/roles", payload as unknown as Record<string, unknown>),

  updateRole: (id: string, payload: Partial<{ name: string; description: string; permissions: string[] }>) =>
    wrapCall<Role>("PATCH", `/api/v1/roles/${id}`, payload as unknown as Record<string, unknown>),

  removeRole: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/roles/${id}`),

  listUsers: (params?: Record<string, unknown>) =>
    wrapCall<UserRecord[]>("GET", "/api/v1/users", params),

  lookupUsers: (branchId?: string) =>
    wrapCall<UserLookup[]>("GET", "/api/v1/users/lookup", branchId ? { branchId } : undefined),

  createUser: (payload: Record<string, unknown>) =>
    wrapCall<UserRecord>("POST", "/api/v1/users", payload),

  updateUser: (id: string, payload: Record<string, unknown>) =>
    wrapCall<UserRecord>("PATCH", `/api/v1/users/${id}`, payload),

  resetUserPassword: (id: string, payload: { password: string; mustChangePassword?: boolean }) =>
    wrapCall<null>("POST", `/api/v1/users/${id}/reset-password`, payload as unknown as Record<string, unknown>),

  removeUser: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/users/${id}`),

  listAuditLogs: (params?: Record<string, unknown>) =>
    wrapCall<AuditLog[]>("GET", "/api/v1/audit-logs", params),

  listNotifications: (params?: Record<string, unknown>) =>
    wrapCall<NotificationItem[]>("GET", "/api/v1/notifications", params),

  unreadNotificationCount: () =>
    wrapCall<{ unread: number }>("GET", "/api/v1/notifications/unread-count"),

  markNotificationRead: (id: string) =>
    wrapCall<null>("POST", `/api/v1/notifications/${id}/read`),

  markAllNotificationsRead: () =>
    wrapCall<null>("POST", "/api/v1/notifications/read-all"),

  scanNotifications: () =>
    wrapCall<unknown>("POST", "/api/v1/notifications/scan"),

  downloadBackup: () =>
    downloadFile("/api/v1/system/backup", `showroompro-backup-${new Date().toISOString().slice(0, 10)}.json`),

  trashTypes: () =>
    wrapCall<string[]>("GET", "/api/v1/system/trash/types"),

  listTrash: (type: string, limit = 50) =>
    wrapCall<TrashItem[]>("GET", "/api/v1/system/trash", { type, limit }),

  restoreTrash: (type: string, id: string) =>
    wrapCall<{ type: string; id: string; label: string }>("POST", `/api/v1/system/trash/${type}/${id}/restore`),
}
