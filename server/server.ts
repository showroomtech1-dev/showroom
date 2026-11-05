// Process entry: connect to the database, start HTTP and the reminder scheduler.
// Run with `npm run dev` / `npm start` (tsx) — never plain `node`.
import "reflect-metadata";
import { createApp } from "./app";
import { env } from "./config/env";
import { AppDataSource } from "./infrastructure/database/dataSource";
import { attachSocketServer, closeSocketServer } from "./infrastructure/realtime/socketServer";
import { startScheduler, stopScheduler } from "./infrastructure/scheduler/scheduler";
import { emailConfigured } from "./shared/utils/mailer";
import { EmailNotifierService } from "./modules/notification/services/emailNotifier.service";

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const pending = await AppDataSource.showMigrations();
  if (pending) console.warn("[db] There are pending migrations — run `npm run migration:run`.");

  // Emails react to events from the running app only (seeds and scripts never send email).
  EmailNotifierService.Instance.register();
  console.log(emailConfigured() ? `[mail] email on (${env.email.provider === "script" ? "Apps Script relay" : "Gmail"})` : "[mail] email off — EMAIL_* not set");

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`ShowroomPro API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
  if (env.socketEnabled) {
    attachSocketServer(server);
    console.log("[socket] live presence on");
  }
  if (env.platformAdminEmails.length === 0) console.log("[platform] PLATFORM_ADMIN_EMAILS not set — the platform admin view is closed");
  startScheduler();

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down…`);
    stopScheduler();
    void closeSocketServer();
    server.close(() => {
      AppDataSource.destroy().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start the server", err);
  process.exit(1);
});
