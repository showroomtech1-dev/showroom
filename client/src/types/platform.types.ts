export interface PlatformTotals {
  businesses: number
  users: number
  activeUsers: number
  deactivatedUsers: number
  neverLoggedIn: number
  signupsToday: number
  signups7d: number
  signups30d: number
  newUsers7d: number
  loggedInToday: number
  activeLast24h: number
  activeLast7d: number
  salesToday: number
  sales30d: number
  sellingBusinesses30d: number
  products: number
  customers: number
  onlineNow: number
  onlineBusinesses: number
}

export interface PlatformDaily {
  date: string
  signups: number
  newUsers: number
  logins: number
}

export interface RecentSignup {
  id: string
  name: string
  createdAt: string
  ownerName: string | null
  ownerEmail: string | null
  ownerPhone: string | null
}

export interface PlatformOverview {
  totals: PlatformTotals
  daily: PlatformDaily[]
  recentSignups: RecentSignup[]
  realtime: boolean
}

export interface PlatformBusiness {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  createdAt: string
  currencySymbol: string
  ownerId: string | null
  ownerName: string | null
  ownerEmail: string | null
  ownerPhone: string | null
  ownerLastLoginAt: string | null
  userCount: number
  activeUserCount: number
  lastLoginAt: string | null
  lastSeenAt: string | null
  branchCount: number
  productCount: number
  customerCount: number
  sales30d: number
  salesTotal30d: number
  lastSaleAt: string | null
  onlineCount: number
}

export interface PlatformUser {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
  lastSeenAt: string | null
  organizationId: string
  businessName: string
  roleName: string
  roleKey: string
  branchName: string | null
  activeSessions: number
  online: boolean
  currentPath: string | null
  device: string | null
}

export interface PlatformLogin {
  id: string
  userId: string | null
  userName: string | null
  email: string | null
  organizationId: string
  businessName: string
  method: "password" | "google"
  ip: string | null
  createdAt: string
}

export interface OnlineUser {
  userId: string
  organizationId: string
  businessName: string
  name: string
  email: string
  roleName: string
  branchName: string | null
  onlineSince: string
  lastActiveAt: string
  currentPath: string | null
  device: string
  ip: string | null
  connections: number
}

export type BusinessSort = "newest" | "oldest" | "name" | "lastActive" | "sales"
export type BusinessStatus = "online" | "active7d" | "dormant" | "neverSold"
export type UserSort = "recent" | "lastSeen" | "lastLogin" | "name"
export type UserStatus = "online" | "active24h" | "active7d" | "neverLoggedIn" | "deactivated" | "new7d"

/** One line in the live activity feed on the platform page. */
export interface LiveEvent {
  id: string
  kind: "signup" | "login" | "online" | "offline"
  at: string
  title: string
  detail: string
}
