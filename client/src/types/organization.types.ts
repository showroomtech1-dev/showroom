import type { BusinessProfile, OrganizationSettings } from "./auth.types"

export interface Branch {
  id: string
  organizationId: string
  name: string
  code: string
  address: string | null
  phone: string | null
  isMain: boolean
  isActive: boolean
  createdAt: string
}

export interface Role {
  id: string
  key: string
  name: string
  description: string | null
  permissions: string[]
  isBuiltIn: boolean
  isLocked: boolean
  userCount: number
}

export interface PermissionDefinition {
  code: string
  category: string
  label: string
}

export interface UserRecord {
  id: string
  name: string
  email: string
  phone: string | null
  branchId: string | null
  branchName: string | null
  roleId: string
  roleKey: string
  roleName: string
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface UserLookup {
  id: string
  name: string
  roleName: string
  branchId: string | null
}

export interface AuditLog {
  id: string
  userId: string | null
  userName: string | null
  action: string
  entityType: string
  entityId: string | null
  summary: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

export interface NotificationItem {
  id: string
  type: string
  severity: "info" | "warning" | "critical"
  title: string
  body: string | null
  entityType: string | null
  entityId: string | null
  branchId: string | null
  isRead: boolean
  createdAt: string
}

export interface TrashItem {
  id: string
  label: string
  deletedAt: string
}

export interface BusinessSettingsBundle {
  business: BusinessProfile
  settings: OrganizationSettings
}
