// Services orchestrate multi-repository workflows inside one transaction by passing an opaque `Tx`
// handle down to repositories. Services never touch entities or SQL themselves.
import type { EntityManager } from "typeorm";
import { AppDataSource } from "./dataSource";

export type Tx = EntityManager;

export function inTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return AppDataSource.transaction("READ COMMITTED", work);
}

/** The manager to use: the caller's transaction, or the default connection. */
export function db(tx?: Tx): EntityManager {
  return tx ?? AppDataSource.manager;
}
