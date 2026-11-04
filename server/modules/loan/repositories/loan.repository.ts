import { SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { LoanEntity, type Loan } from "../entities/loan.entity";
import { LoanRepaymentEntity, type LoanRepayment } from "../entities/loanRepayment.entity";

export interface LoanDTO {
  id: string;
  code: string;
  employeeId: string;
  employeeName: string;
  type: "loan" | "advance";
  principal: number;
  issueDate: string;
  installmentAmount: number;
  amountRepaid: number;
  outstanding: number;
  status: string;
  method: string;
  accountId: string;
  accountName: string;
  reference: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: Date;
}

export interface LoanRepaymentDTO {
  id: string;
  amount: number;
  repaymentDate: string;
  source: string;
  method: string | null;
  payrollItemId: string | null;
  createdAt: Date;
}

const SELECT = `
  SELECT l.id, l.code, l.employee_id AS "employeeId", e.first_name || ' ' || e.last_name AS "employeeName", l.type,
         l.principal, l.issue_date AS "issueDate", l.installment_amount AS "installmentAmount", l.amount_repaid AS "amountRepaid",
         l.principal - l.amount_repaid AS outstanding, l.status, l.method, l.account_id AS "accountId", a.name AS "accountName",
         l.reference, l.notes, u.name AS "createdByName", l.created_at AS "createdAt"
  FROM loans l
  JOIN employees e ON e.id = l.employee_id
  JOIN accounts a ON a.id = l.account_id
  LEFT JOIN users u ON u.id = l.created_by_id`;

export class LoanRepository {
  static Instance = new LoanRepository();
  private constructor() {}

  async list(organizationId: string, f: { page: number; limit: number; employeeId?: string; status?: string; type?: string }): Promise<PagedRows<LoanDTO>> {
    const p = new SqlParams();
    const where = [`l.organization_id = ${p.add(organizationId)}`, "l.deleted_at IS NULL"];
    if (f.employeeId) where.push(`l.employee_id = ${p.add(f.employeeId)}`);
    if (f.status) where.push(`l.status = ${p.add(f.status)}`);
    if (f.type) where.push(`l.type = ${p.add(f.type)}`);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT} WHERE ${where.join(" AND ")}) x
       ORDER BY x."issueDate" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<LoanDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<LoanDTO | null> {
    const rows: LoanDTO[] = await db(tx).query(`${SELECT} WHERE l.organization_id = $1 AND l.id = $2 AND l.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  /** Active loans/advances of an employee with what is still owed, oldest first, locked. */
  async activeForEmployeeForUpdate(employeeId: string, tx: Tx): Promise<Array<{ id: string; code: string; type: string; installmentAmount: number; outstanding: number }>> {
    return tx.query(
      `SELECT id, code, type, installment_amount AS "installmentAmount", principal - amount_repaid AS outstanding
       FROM loans WHERE employee_id = $1 AND deleted_at IS NULL AND status = 'active' AND amount_repaid < principal
       ORDER BY issue_date, created_at FOR UPDATE`,
      [employeeId]
    );
  }

  async outstandingForEmployee(employeeId: string): Promise<{ loans: number; advances: number }> {
    const rows: Array<{ loans: number; advances: number }> = await db().query(
      `SELECT COALESCE(SUM(principal - amount_repaid) FILTER (WHERE type = 'loan'), 0) AS loans,
              COALESCE(SUM(principal - amount_repaid) FILTER (WHERE type = 'advance'), 0) AS advances
       FROM loans WHERE employee_id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [employeeId]
    );
    return { loans: Number(rows[0]?.loans ?? 0), advances: Number(rows[0]?.advances ?? 0) };
  }

  async repayments(loanId: string): Promise<LoanRepaymentDTO[]> {
    return db().query(
      `SELECT id, amount, repayment_date AS "repaymentDate", source, method, payroll_item_id AS "payrollItemId", created_at AS "createdAt"
       FROM loan_repayments WHERE loan_id = $1 AND deleted_at IS NULL ORDER BY repayment_date, created_at`,
      [loanId]
    );
  }

  async create(data: Omit<Loan, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(LoanEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<Loan>, tx: Tx): Promise<void> {
    await tx.getRepository(LoanEntity).update({ id, organizationId }, data);
  }

  async lock(id: string, tx: Tx): Promise<void> {
    await tx.query(`SELECT id FROM loans WHERE id = $1 FOR UPDATE`, [id]);
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(LoanEntity).softDelete({ id, organizationId });
  }

  /** amount_repaid += delta, settling the loan when fully repaid (and re-opening it if a repayment is undone). */
  async applyRepaid(loanId: string, delta: number, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE loans SET amount_repaid = amount_repaid + $2,
              status = CASE WHEN status = 'written_off' THEN status WHEN amount_repaid + $2 >= principal THEN 'settled' ELSE 'active' END,
              updated_at = now()
       WHERE id = $1`,
      [loanId, delta]
    );
  }

  async insertRepayment(data: Omit<LoanRepayment, "id" | "createdAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(LoanRepaymentEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async repaymentsForPayrollItems(itemIds: string[], tx: Tx): Promise<Array<{ id: string; loanId: string; amount: number }>> {
    if (itemIds.length === 0) return [];
    return tx.query(
      `SELECT id, loan_id AS "loanId", amount FROM loan_repayments WHERE payroll_item_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [itemIds]
    );
  }

  async softDeleteRepayments(ids: string[], tx: Tx): Promise<void> {
    if (ids.length > 0) await tx.query(`UPDATE loan_repayments SET deleted_at = now() WHERE id = ANY($1::uuid[])`, [ids]);
  }

  async countRepayments(loanId: string): Promise<number> {
    const rows: Array<{ count: number }> = await db().query(`SELECT COUNT(*) AS count FROM loan_repayments WHERE loan_id = $1 AND deleted_at IS NULL`, [loanId]);
    return Number(rows[0]?.count ?? 0);
  }
}
