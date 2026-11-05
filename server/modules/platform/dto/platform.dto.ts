import type { OnlineUserDTO } from "../../../infrastructure/realtime/presence";

export interface PlatformTotalsDTO {
  businesses: number;
  users: number;
  activeUsers: number;
  deactivatedUsers: number;
  neverLoggedIn: number;
  signupsToday: number;
  signups7d: number;
  signups30d: number;
  newUsers7d: number;
  loggedInToday: number;
  activeLast24h: number;
  activeLast7d: number;
  salesToday: number;
  sales30d: number;
  sellingBusinesses30d: number;
  products: number;
  customers: number;
}

export interface PlatformDailyDTO {
  date: string;
  signups: number;
  newUsers: number;
  /** Distinct people who signed in that day. */
  logins: number;
}

export interface RecentSignupDTO {
  id: string;
  name: string;
  createdAt: Date;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
}

export interface PlatformOverviewDTO {
  totals: PlatformTotalsDTO & { onlineNow: number; onlineBusinesses: number };
  daily: PlatformDailyDTO[];
  recentSignups: RecentSignupDTO[];
  /** False when the API runs without Socket.io (e.g. Vercel functions) — "online" is then always empty. */
  realtime: boolean;
}

export interface PlatformBusinessDTO {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: Date;
  currencySymbol: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerLastLoginAt: Date | null;
  userCount: number;
  activeUserCount: number;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  branchCount: number;
  productCount: number;
  customerCount: number;
  sales30d: number;
  salesTotal30d: number;
  lastSaleAt: Date | null;
  onlineCount: number;
}

export interface PlatformUserDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  organizationId: string;
  businessName: string;
  roleName: string;
  roleKey: string;
  branchName: string | null;
  /** Signed-in devices (refresh tokens still valid). */
  activeSessions: number;
  online: boolean;
  currentPath: string | null;
  device: string | null;
}

export interface PlatformLoginDTO {
  id: string;
  userId: string | null;
  userName: string | null;
  email: string | null;
  organizationId: string;
  businessName: string;
  method: "password" | "google";
  ip: string | null;
  createdAt: Date;
}

export type { OnlineUserDTO };
