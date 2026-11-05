// Records when a user was last using the app. Every authenticated request calls markSeen(); the
// database is written at most once per user every few minutes so busy users don't cost a write per call.
import { UserRepository } from "../../user/repositories/user.repository";

const THROTTLE_MS = 3 * 60_000;
const lastWrite = new Map<string, number>();

export function markSeen(userId: string, options: { force?: boolean } = {}): void {
  const now = Date.now();
  if (!options.force && now - (lastWrite.get(userId) ?? 0) < THROTTLE_MS) return;
  lastWrite.set(userId, now);
  UserRepository.Instance.touchSeen(userId, new Date(now)).catch((err) => console.error("[lastSeen] update failed", err));
}
