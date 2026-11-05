import "reflect-metadata";
import path from "path";
import { types } from "pg";
import { DataSource, type DataSourceOptions } from "typeorm";
import { env } from "../../config/env";
import { ALL_ENTITIES } from "./entities";
import { installResilientDns } from "./resilientDns";

installResilientDns();

// Raw-query type parsing: keep DATE as 'YYYY-MM-DD' (no timezone shifting) and return
// BIGINT / NUMERIC aggregates as numbers. All amounts are integer kobo, well inside 2^53.
types.setTypeParser(1082, (value: string) => value);
types.setTypeParser(20, (value: string) => Number(value));
types.setTypeParser(1700, (value: string) => Number(value));

/** With DB_SSL=true the `ssl` option below controls TLS; an `sslmode` in the URL would override it. */
function connectionUrl(url: string): string {
  if (!env.db.ssl) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("sslmode");
    return parsed.toString();
  } catch {
    return url;
  }
}

const connection: Partial<DataSourceOptions> = env.db.url
  ? { url: connectionUrl(env.db.url) }
  : { host: env.db.host, port: env.db.port, username: env.db.user, password: env.db.password, database: env.db.name };

export const AppDataSource = new DataSource({
  type: "postgres",
  ...connection,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
  entities: ALL_ENTITIES,
  migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
  migrationsTableName: "migrations",
  synchronize: false,
  logging: env.db.logging,
  uuidExtension: "pgcrypto",
  // Reuse connections, but keep the pool small: the database has a hard connection cap shared by every
  // process (error 53300 "remaining connection slots are reserved…" means it was hit).
  extra: {
    max: env.db.poolMax,
    keepAlive: true,
    idleTimeoutMillis: env.db.poolIdleMs,
    connectionTimeoutMillis: 20_000,
  },
} as DataSourceOptions);
