import { db, type Tx } from "../../../infrastructure/database/transaction";

export class CounterRepository {
  static Instance = new CounterRepository();
  private constructor() {}

  /** Atomically increments and returns the next value of an organisation sequence. */
  async next(organizationId: string, key: string, tx?: Tx): Promise<number> {
    const rows: Array<{ value: number }> = await db(tx).query(
      `INSERT INTO counters (organization_id, key, value) VALUES ($1, $2, 1)
       ON CONFLICT (organization_id, key) DO UPDATE SET value = counters.value + 1
       RETURNING value`,
      [organizationId, key]
    );
    return Number(rows[0].value);
  }
}
