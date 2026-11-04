// Process entry: connect to the database, start HTTP and the reminder scheduler.
// Run with `npm run dev` / `npm start` (tsx) — never plain `node`.
import "reflect-metadata";
import { createApp } from "./app";
import { env } from "./config/env";
import { AppDataSource } from "./infrastructure/database/dataSource";
import { startScheduler, stopScheduler } from "./infrastructure/scheduler/scheduler";

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const pending = await AppDataSource.showMigrations();
  if (pending) console.warn("[db] There are pending migrations — run `npm run migration:run`.");

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`ShowroomPro API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
  startScheduler();

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down…`);
    stopScheduler();
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
