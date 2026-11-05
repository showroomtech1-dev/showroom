// Who is connected right now. Kept in this process's memory: one user can have several tabs or
// devices open, and they count as online until the last one disconnects. With more than one server
// instance each would only know its own connections.

export interface PresenceProfile {
  userId: string;
  organizationId: string;
  businessName: string;
  name: string;
  email: string;
  roleName: string;
  branchName: string | null;
}

interface PresenceConnection {
  connectedAt: Date;
  lastActiveAt: Date;
  path: string | null;
  device: string;
  ip: string | null;
}

interface PresenceUser {
  profile: PresenceProfile;
  connections: Map<string, PresenceConnection>;
}

/** What the platform admin sees for one online user. */
export interface OnlineUserDTO extends PresenceProfile {
  /** When the oldest of their current connections opened. */
  onlineSince: string;
  lastActiveAt: string;
  /** Page of their most recently active connection. */
  currentPath: string | null;
  device: string;
  ip: string | null;
  connections: number;
}

/** "Chrome on Windows", "Safari on iPhone"… Good enough to tell devices apart, not a full UA parser. */
export function describeDevice(userAgent: string | undefined | null): string {
  const ua = userAgent ?? "";
  if (!ua) return "Unknown device";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "Unknown OS";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser";
  return `${browser} on ${os}`;
}

class PresenceStore {
  private readonly users = new Map<string, PresenceUser>();

  /** Returns true when this is the user's first open connection (they just came online). */
  connect(socketId: string, profile: PresenceProfile, info: { device: string; ip: string | null; path: string | null }): boolean {
    const now = new Date();
    const existing = this.users.get(profile.userId);
    const entry = existing ?? { profile, connections: new Map<string, PresenceConnection>() };
    entry.profile = profile;
    entry.connections.set(socketId, { connectedAt: now, lastActiveAt: now, path: info.path, device: info.device, ip: info.ip });
    this.users.set(profile.userId, entry);
    return !existing;
  }

  /** Returns true when that was the user's last connection (they are now offline). */
  disconnect(userId: string, socketId: string): boolean {
    const entry = this.users.get(userId);
    if (!entry) return false;
    entry.connections.delete(socketId);
    if (entry.connections.size > 0) return false;
    this.users.delete(userId);
    return true;
  }

  activity(userId: string, socketId: string, path: string | null): void {
    const conn = this.users.get(userId)?.connections.get(socketId);
    if (!conn) return;
    conn.lastActiveAt = new Date();
    if (path !== null) conn.path = path;
  }

  get(userId: string): OnlineUserDTO | null {
    const entry = this.users.get(userId);
    return entry ? this.toDTO(entry) : null;
  }

  list(): OnlineUserDTO[] {
    return [...this.users.values()].map((e) => this.toDTO(e)).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  }

  userIds(): string[] {
    return [...this.users.keys()];
  }

  organizationIds(): string[] {
    return [...new Set([...this.users.values()].map((e) => e.profile.organizationId))];
  }

  isOnline(userId: string): boolean {
    return this.users.has(userId);
  }

  /** Online user count per business. */
  countsByOrganization(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const e of this.users.values()) counts.set(e.profile.organizationId, (counts.get(e.profile.organizationId) ?? 0) + 1);
    return counts;
  }

  private toDTO(entry: PresenceUser): OnlineUserDTO {
    const conns = [...entry.connections.values()];
    const oldest = conns.reduce((a, b) => (a.connectedAt <= b.connectedAt ? a : b));
    const latest = conns.reduce((a, b) => (a.lastActiveAt >= b.lastActiveAt ? a : b));
    return {
      ...entry.profile,
      onlineSince: oldest.connectedAt.toISOString(),
      lastActiveAt: latest.lastActiveAt.toISOString(),
      currentPath: latest.path,
      device: latest.device,
      ip: latest.ip,
      connections: conns.length,
    };
  }
}

export const presence = new PresenceStore();
