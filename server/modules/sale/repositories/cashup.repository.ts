import { SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { CashReconciliationDTO } from "../dto/sale.dto";
import { CashReconciliationEntity, type CashReconciliation } from "../entities/cashReconciliation.entity";

const SELECT = `
  SELECT r.id, r.branch_id AS "branchId", b.name AS "branchName", r.account_id AS "accountId", a.name AS "accountName",
         r.recon_date AS "reconDate", r.expected_amount AS "expectedAmount", r.counted_amount AS "countedAmount",
         r.difference, r.notes, r.adjustment_posted AS "adjustmentPosted", u.name AS "closedByName", r.created_at AS "createdAt"
  FROM cash_reconciliations r
  JOIN branches b ON b.id = r.branch_id
  JOIN accounts a ON a.id = r.account_id
  LEFT JOIN users u ON u.id = r.closed_by_id`;

export class CashupRepository {
  static Instance = new CashupRepository();
  private constructor() {}

  async list(organizationId: string, f: { page: number; limit: number; branchId: string | null; from?: string; to?: string }): Promise<PagedRows<CashReconciliationDTO>> {
    const p = new SqlParams();
    const where = [`r.organization_id = ${p.add(organizationId)}`];
    if (f.branchId) where.push(`r.branch_id = ${p.add(f.branchId)}`);
    if (f.from) where.push(`r.recon_date >= ${p.add(f.from)}`);
    if (f.to) where.push(`r.recon_date <= ${p.add(f.to)}`);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT} WHERE ${where.join(" AND ")}) x
       ORDER BY x."reconDate" DESC, x."createdAt" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<CashReconciliationDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findForDay(accountId: string, date: string, tx?: Tx): Promise<CashReconciliationDTO | null> {
    const rows: CashReconciliationDTO[] = await db(tx).query(`${SELECT} WHERE r.account_id = $1 AND r.recon_date = $2`, [accountId, date]);
    return rows[0] ?? null;
  }

  async create(data: Omit<CashReconciliation, "id" | "createdAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(CashReconciliationEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }
}
