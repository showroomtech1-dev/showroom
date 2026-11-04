import { db, type Tx } from "../../../infrastructure/database/transaction";
import type { AccountDTO, AccountOptionDTO } from "../dto/finance.dto";
import { AccountEntity, type Account } from "../entities/account.entity";

const SELECT_ACCOUNT = `
  SELECT a.id, a.branch_id AS "branchId", b.name AS "branchName", a.name, a.type, a.bank_name AS "bankName",
         a.account_number AS "accountNumber", a.opening_balance AS "openingBalance",
         a.opening_balance + COALESCE((
           SELECT SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END)
           FROM account_transactions t WHERE t.account_id = a.id
         ), 0) AS balance,
         a.is_default AS "isDefault", a.is_active AS "isActive", a.notes, a.created_at AS "createdAt"
  FROM accounts a
  LEFT JOIN branches b ON b.id = a.branch_id`;

export class AccountRepository {
  static Instance = new AccountRepository();
  private constructor() {}

  async list(organizationId: string, opts: { branchId?: string | null; includeInactive?: boolean }): Promise<AccountDTO[]> {
    const params: unknown[] = [organizationId];
    const where = ["a.organization_id = $1", "a.deleted_at IS NULL"];
    if (!opts.includeInactive) where.push("a.is_active = true");
    if (opts.branchId) {
      params.push(opts.branchId);
      where.push(`(a.branch_id = $${params.length} OR a.branch_id IS NULL)`);
    }
    return db().query(`${SELECT_ACCOUNT} WHERE ${where.join(" AND ")} ORDER BY a.type, a.name LIMIT 200`, params);
  }

  async options(organizationId: string): Promise<AccountOptionDTO[]> {
    return db().query(
      `SELECT id, name, type, branch_id AS "branchId", is_default AS "isDefault"
       FROM accounts WHERE organization_id = $1 AND deleted_at IS NULL AND is_active = true
       ORDER BY type, is_default DESC, name LIMIT 200`,
      [organizationId]
    );
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<AccountDTO | null> {
    const rows: AccountDTO[] = await db(tx).query(
      `${SELECT_ACCOUNT} WHERE a.organization_id = $1 AND a.id = $2 AND a.deleted_at IS NULL`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  /** Best account of a type for a branch: branch-specific default first, then org-wide default, then any. */
  async findDefault(organizationId: string, type: string, branchId: string | null, tx?: Tx): Promise<string | null> {
    const rows: Array<{ id: string }> = await db(tx).query(
      `SELECT id FROM accounts
       WHERE organization_id = $1 AND type = $2 AND is_active = true AND deleted_at IS NULL
       ORDER BY (branch_id IS NOT DISTINCT FROM $3::uuid) DESC, (branch_id IS NULL) DESC, is_default DESC, created_at
       LIMIT 1`,
      [organizationId, type, branchId]
    );
    return rows[0]?.id ?? null;
  }

  async create(data: Omit<Account, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx?: Tx): Promise<string> {
    const repo = db(tx).getRepository(AccountEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<Account>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(AccountEntity).update({ id, organizationId }, data);
  }

  async clearDefault(organizationId: string, type: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(AccountEntity).update({ organizationId, type, isDefault: true }, { isDefault: false });
  }

  async hasTransactions(id: string): Promise<boolean> {
    const rows: Array<{ exists: boolean }> = await db().query(
      `SELECT EXISTS (SELECT 1 FROM account_transactions WHERE account_id = $1) AS exists`,
      [id]
    );
    return Boolean(rows[0]?.exists);
  }

  async softDelete(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(AccountEntity).softDelete({ id, organizationId });
  }
}
