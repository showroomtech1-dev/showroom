// Short-lived cache of resolved actors so every request doesn't hit the DB for permissions.
// Any write to a user or role invalidates the affected entries, so edits take effect immediately.
import type { Actor } from "../types/actor";

const TTL_MS = 60_000;

interface Entry {
  actor: Actor;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

export const PermissionCache = {
  get(userId: string): Actor | null {
    const entry = cache.get(userId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      cache.delete(userId);
      return null;
    }
    return entry.actor;
  },
  set(actor: Actor): void {
    cache.set(actor.id, { actor, expiresAt: Date.now() + TTL_MS });
  },
  invalidateUser(userId: string): void {
    cache.delete(userId);
  },
  invalidateOrganization(organizationId: string): void {
    for (const [key, entry] of cache) {
      if (entry.actor.organizationId === organizationId) cache.delete(key);
    }
  },
  clear(): void {
    cache.clear();
  },
};
