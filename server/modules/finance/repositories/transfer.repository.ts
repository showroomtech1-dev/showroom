import { SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { TransferDTO } from "../dto/finance.dto";
import { AccountTransferEntity, type AccountTransfer } from "../entities/accountTransfer.entity";

const SELECT = `
  SELECT t.id, t.code, t.from_account_id AS "fromAccountId", fa.name AS "fromAccountName",
         t.to_account_id AS "toAccountId", ta.name AS "toAccountName", t.amount, t.transfer_date AS "transferDate",
         t.reference, t.notes, u.name AS "createdByName", t.created_at AS "createdAt"
  FROM account_transfers t
  JOIN accounts fa ON fa.id = t.from_account_id
  JOIN accounts ta ON ta.id = t.to_account_id
  LEFT JOIN users u ON u.id = t.created_by_id`;

export class TransferRepository {
  static Instance = new TransferRepository();
  private constructor() {}

  async list(organizationId: string, f: { page: number; limit: number; from?: string; to?: string; accountId?: string }): Promise<PagedRows<TransferDTO>> {
    const p = new SqlParams();
    const where = [`t.organization_id = ${p.add(organizationId)}`, "t.deleted_at IS NULL"];
    if (f.from) where.push(`t.transfer_date >= ${p.add(f.from)}`);
    if (f.to) where.push(`t.transfer_date <= ${p.add(f.to)}`);
    if (f.accountId) {
      const a = p.add(f.accountId);
      where.push(`(t.from_account_id = ${a} OR t.to_account_id = ${a})`);
    }
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT} WHERE ${where.join(" AND ")}) x
       ORDER BY x."transferDate" DESC, x."createdAt" DESC
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<TransferDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<TransferDTO | null> {
    const rows: TransferDTO[] = await db(tx).query(
      `${SELECT} WHERE t.organization_id = $1 AND t.id = $2 AND t.deleted_at IS NULL`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async create(data: Omit<AccountTransfer, "id" | "createdAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(AccountTransferEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(AccountTransferEntity).softDelete({ id, organizationId });
  }
}
