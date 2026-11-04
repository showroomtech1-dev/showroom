// npm run migration:run | migration:revert — TypeORM migrations through tsx.
import "reflect-metadata";
import { AppDataSource } from "../infrastructure/database/dataSource";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "run";
  await AppDataSource.initialize();
  try {
    if (command === "revert") {
      await AppDataSource.undoLastMigration({ transaction: "each" });
      console.log("Reverted the last migration.");
    } else {
      const applied = await AppDataSource.runMigrations({ transaction: "each" });
      console.log(applied.length === 0 ? "Database is up to date." : `Applied ${applied.length} migration(s):\n  ${applied.map((m) => m.name).join("\n  ")}`);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
