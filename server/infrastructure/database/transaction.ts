// Services orchestrate multi-repository workflows inside one transaction by passing an opaque `Tx`
// handle down to repositories. Services never touch entities or SQL themselves.
import type { EntityManager } from "typeorm";
import { AppDataSource } from "./dataSource";

export type Tx = EntityManager;

export function inTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return AppDataSource.transaction("READ COMMITTED", work);
}

/**
 * Runs an UPDATE / DELETE … RETURNING and gives back the returned rows. (TypeORM's query() returns
 * `[rows, rowCount]` for UPDATE and DELETE statements, unlike SELECT / INSERT which return just rows.)
 */
export async function updateReturning<T>(manager: EntityManager, sql: string, params: unknown[]): Promise<T[]> {
  const result: unknown = await manager.query(sql, params);
  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && typeof result[1] === "number") {
    return result[0] as T[];
  }
  return result as T[];
}

/** The manager to use: the caller's transaction, or the default connection. */
export function db(tx?: Tx): EntityManager {
  return tx ?? AppDataSource.manager;
}
