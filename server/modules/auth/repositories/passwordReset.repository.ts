import { IsNull } from "typeorm";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { PasswordResetEntity } from "../entities/passwordReset.entity";

export interface PasswordResetRow {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
}

export class PasswordResetRepository {
  static Instance = new PasswordResetRepository();
  private constructor() {}

  /** Starting a new reset cancels any earlier unused codes for the user. */
  async create(userId: string, codeHash: string, expiresAt: Date): Promise<void> {
    await db().getRepository(PasswordResetEntity).update({ userId, usedAt: IsNull() }, { usedAt: new Date() });
    await db().getRepository(PasswordResetEntity).insert({ userId, codeHash, expiresAt, attempts: 0 });
  }

  async countRecent(userId: string, sinceMinutes: number): Promise<number> {
    const rows: Array<{ count: number }> = await db().query(
      `SELECT COUNT(*) AS count FROM password_resets WHERE user_id = $1 AND created_at > now() - make_interval(mins => $2)`,
      [userId, sinceMinutes]
    );
    return Number(rows[0]?.count ?? 0);
  }

  /** The latest unused, unexpired code for the user, locked. */
  async activeForUpdate(userId: string, tx: Tx): Promise<PasswordResetRow | null> {
    return tx
      .getRepository(PasswordResetEntity)
      .createQueryBuilder("r")
      .setLock("pessimistic_write")
      .select(["r.id", "r.userId", "r.codeHash", "r.expiresAt", "r.attempts"])
      .where("r.userId = :userId AND r.usedAt IS NULL AND r.expiresAt > now()", { userId })
      .orderBy("r.createdAt", "DESC")
      .getOne();
  }

  async addAttempt(id: string, tx: Tx): Promise<void> {
    await tx.query(`UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1`, [id]);
  }

  async markUsed(id: string, tx: Tx): Promise<void> {
    await tx.getRepository(PasswordResetEntity).update({ id }, { usedAt: new Date() });
  }
}
