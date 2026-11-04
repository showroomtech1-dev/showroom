// Background reminders: refreshes alerts (low stock, supplier payments due, customer debts,
// recurring expenses) on a fixed interval. One scan at a time; failures are logged, never thrown.
import { env } from "../../config/env";
import { RefreshTokenRepository } from "../../modules/auth/repositories/refreshToken.repository";
import { AlertScannerService } from "../../modules/notification/services/alertScanner.service";

let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await AlertScannerService.Instance.scanAll();
    await RefreshTokenRepository.Instance.purgeExpired();
  } catch (err) {
    console.error("[scheduler] scan failed", err);
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  if (!env.scheduler.enabled || timer) return;
  const intervalMs = Math.max(env.scheduler.intervalMinutes, 5) * 60_000;
  // First scan shortly after boot, then on the interval.
  setTimeout(() => void tick(), 15_000).unref();
  timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  console.log(`[scheduler] reminders every ${Math.round(intervalMs / 60_000)} min`);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
