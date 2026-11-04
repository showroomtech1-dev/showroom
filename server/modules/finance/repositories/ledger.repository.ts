import { SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { num } from "../../../shared/utils/money";
import type { LedgerEntryInput, LedgerRowDTO } from "../dto/finance.dto";
import { AccountTransactionEntity } from "../entities/accountTransaction.entity";

export interface ReferenceNet {
  accountId: string;
  branchId: string | null;
  /** Σ in − Σ out for the reference on that account. */
  net: number;
}

export class LedgerRepository {
  static Instance = new LedgerRepository();
  private constructor() {}

  async insert(organizationId: string, createdById: string | null, entry: LedgerEntryInput, tx: Tx): Promise<void> {
    await tx.getRepository(AccountTransactionEntity).insert({
      organizationId,
      accountId: entry.accountId,
      branchId: entry.branchId ?? null,
      transactionDate: entry.date,
      direction: entry.direction,
      amount: entry.amount,
      type: entry.type,
      referenceType: entry.referenceType ?? null,
      referenceId: entry.referenceId ?? null,
      description: entry.description.slice(0, 255),
      createdById,
    });
  }

  async netByReference(organizationId: string, referenceType: string, referenceId: string, tx: Tx): Promise<ReferenceNet[]> {
    return tx.query(
      `SELECT account_id AS "accountId", MAX(branch_id::text)::uuid AS "branchId",
              SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) AS net
       FROM account_transactions
       WHERE organization_id = $1 AND reference_type = $2 AND reference_id = $3
       GROUP BY account_id`,
      [organizationId, referenceType, referenceId]
    );
  }

  /** Balance of an account at the end of `date` (inclusive). */
  async balanceAt(accountId: string, date: string, tx?: Tx): Promise<number> {
    const rows: Array<{ balance: number }> = await db(tx).query(
      `SELECT a.opening_balance + COALESCE((
         SELECT SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END)
         FROM account_transactions t WHERE t.account_id = a.id AND t.transaction_date <= $2
       ), 0) AS balance
       FROM accounts a WHERE a.id = $1`,
      [accountId, date]
    );
    return num(rows[0]?.balance);
  }

  async statementRows(accountId: string, from: string, to: string, openingBalance: number): Promise<LedgerRowDTO[]> {
    const p = new SqlParams();
    return db().query(
      `SELECT t.id, t.transaction_date AS "transactionDate", t.direction, t.amount, t.type,
              t.reference_type AS "referenceType", t.reference_id AS "referenceId", t.description,
              u.name AS "createdByName", t.created_at AS "createdAt",
              ${p.add(openingBalance)}::bigint + SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END)
                OVER (ORDER BY t.transaction_date, t.created_at, t.id) AS "runningBalance"
       FROM account_transactions t
       LEFT JOIN users u ON u.id = t.created_by_id
       WHERE t.account_id = ${p.add(accountId)} AND t.transaction_date BETWEEN ${p.add(from)} AND ${p.add(to)}
       ORDER BY t.transaction_date, t.created_at, t.id
       LIMIT 5000`,
      p.values
    );
  }

  /** Sum of in/out for an account on one day (cash-up). */
  async dayTotals(accountId: string, date: string): Promise<{ totalIn: number; totalOut: number }> {
    const rows: Array<{ totalIn: number; totalOut: number }> = await db().query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE direction = 'in'), 0) AS "totalIn",
              COALESCE(SUM(amount) FILTER (WHERE direction = 'out'), 0) AS "totalOut"
       FROM account_transactions WHERE account_id = $1 AND transaction_date = $2`,
      [accountId, date]
    );
    return { totalIn: num(rows[0]?.totalIn), totalOut: num(rows[0]?.totalOut) };
  }
}
