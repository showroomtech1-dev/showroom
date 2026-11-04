import { EntitySchema } from "typeorm";
import { createdAt, manyToOne, primaryId, timestampColumn, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  user?: { id: string };
}

export const RefreshTokenEntity = new EntitySchema<RefreshToken>({
  name: "RefreshToken",
  tableName: "refresh_tokens",
  columns: {
    id: primaryId(),
    userId: uuidColumn("user_id"),
    tokenHash: varchar("token_hash", 64),
    expiresAt: timestampColumn("expires_at", false),
    revokedAt: timestampColumn("revoked_at"),
    userAgent: varchar("user_agent", 255, true),
    ip: varchar("ip", 64, true),
    createdAt: createdAt(),
  },
  relations: { user: manyToOne("User", "user_id", "CASCADE") },
  indices: [
    { name: "UQ_refresh_tokens_hash", columns: ["tokenHash"], unique: true },
    { name: "IDX_refresh_tokens_user", columns: ["userId"] },
  ],
});
