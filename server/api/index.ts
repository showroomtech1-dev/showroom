import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../app";
import { AppDataSource } from "../infrastructure/database/dataSource";
import { EmailNotifierService } from "../modules/notification/services/emailNotifier.service";

const app = createApp();
let dbInitializedPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!dbInitializedPromise) {
    dbInitializedPromise = (async () => {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      EmailNotifierService.Instance.register();
    })().catch((err) => {
      dbInitializedPromise = null;
      throw err;
    });
  }
  return dbInitializedPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensureInitialized();
  return app(req as never, res as never);
}
