// One-time password reset codes. Only a keyed hash of the code is stored; codes expire, can be
// used once, and lock after too many wrong attempts.
import { EntitySchema } from "typeorm";
import { createdAt, intColumn, manyToOne, primaryId, timestampColumn, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface PasswordReset {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  attempts: number;
  createdAt: Date;
  user?: { id: string };
}

export const PasswordResetEntity = new EntitySchema<PasswordReset>({
  name: "PasswordReset",
  tableName: "password_resets",
  columns: {
    id: primaryId(),
    userId: uuidColumn("user_id"),
    codeHash: varchar("code_hash", 64),
    expiresAt: timestampColumn("expires_at", false),
    usedAt: timestampColumn("used_at"),
    attempts: intColumn("attempts", 0),
    createdAt: createdAt(),
  },
  relations: { user: manyToOne("User", "user_id", "CASCADE") },
  indices: [{ name: "IDX_password_resets_user", columns: ["userId", "createdAt"] }],
});
