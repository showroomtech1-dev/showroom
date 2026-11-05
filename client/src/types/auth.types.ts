export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface SessionUser {
  id: string
  name: string
  email: string
  phone: string | null
  branchId: string | null
  branchName: string | null
  roleId: string
  roleKey: string
  roleName: string
  mustChangePassword: boolean
}

export interface BusinessProfile {
  id: string
  name: string
  legalName: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  logoUrl: string | null
  logoPublicId: string | null
}

export interface OrganizationSettings {
  currencyCode: string
  currencySymbol: string
  timezone: string
  receiptHeader: string | null
  receiptFooter: string | null
  taxEnabled: boolean
  taxName: string
  taxRateBps: number
  taxInclusive: boolean
  taxNumber: string | null
  commissionEnabled: boolean
  commissionRateBps: number
  allowNegativeStock: boolean
  reminderDaysBeforeDue: number
  defaultCreditDays: number
  workStartTime: string
  lateGraceMinutes: number
  latenessDeduction: number
  absenceDeduction: number
}

export interface SessionData {
  user: SessionUser
  permissions: readonly string[]
  business: BusinessProfile
  settings: OrganizationSettings
}

export interface LoginResult extends SessionData {
  tokens: TokenPair
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  businessName: string
  ownerName: string
  email: string
  password: string
  phone?: string
  address?: string
}

export interface GoogleSignInPayload {
  idToken?: string
  email?: string
  name?: string
  businessName?: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface ResetPasswordWithCodePayload {
  email: string
  code: string
  newPassword: string
}

export interface ForgotPasswordResult {
  message: string
  devCode?: string
}

export interface UpdateProfilePayload {
  name?: string
  phone?: string | null
  branchId?: string | null
}
