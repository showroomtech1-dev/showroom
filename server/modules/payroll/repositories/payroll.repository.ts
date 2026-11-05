import { SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { num } from "../../../shared/utils/money";
import type { PayrollItemDTO, PayrollRunDTO, PayslipDTO } from "../dto/payroll.dto";
import { PayrollItemEntity, type PayrollItem } from "../entities/payrollItem.entity";
import { PayrollPaymentEntity, type PayrollPayment } from "../entities/payrollPayment.entity";
import { PayrollRunEntity, type PayrollRun } from "../entities/payrollRun.entity";

const RUN = `
  SELECT r.id, r.code, r.branch_id AS "branchId", b.name AS "branchName", r.frequency, r.period_start AS "periodStart",
         r.period_end AS "periodEnd", r.pay_date AS "payDate", r.status, r.total_gross AS "totalGross",
         r.total_deductions AS "totalDeductions", r.total_net AS "totalNet", r.total_paid AS "totalPaid",
         (SELECT COUNT(*) FROM payroll_items i WHERE i.run_id = r.id)::int AS "employeeCount", r.notes,
         cu.name AS "createdByName", au.name AS "approvedByName", r.approved_at AS "approvedAt", r.created_at AS "createdAt"
  FROM payroll_runs r
  LEFT JOIN branches b ON b.id = r.branch_id
  LEFT JOIN users cu ON cu.id = r.created_by_id
  LEFT JOIN users au ON au.id = r.approved_by_id`;

const ITEM = `
  SELECT i.id, i.run_id AS "runId", i.employee_id AS "employeeId", e.code AS "employeeCode",
         e.first_name || ' ' || e.last_name AS "employeeName", e.job_title AS "jobTitle", i.basic_salary AS "basicSalary",
         i.allowances, i.allowance_lines AS "allowanceLines", i.bonus, i.commission, i.gross_pay AS "grossPay",
         i.lateness_deduction AS "latenessDeduction", i.absence_deduction AS "absenceDeduction", i.loan_deduction AS "loanDeduction",
         i.advance_deduction AS "advanceDeduction", i.other_deductions AS "otherDeductions", i.deduction_lines AS "deductionLines",
         i.loan_deduction_lines AS "loanDeductionLines", i.total_deductions AS "totalDeductions", i.net_pay AS "netPay",
         i.amount_paid AS "amountPaid", i.status, i.days_late AS "daysLate", i.days_absent AS "daysAbsent", i.notes,
         (SELECT ps.id FROM payslips ps WHERE ps.payroll_item_id = i.id) AS "payslipId"
  FROM payroll_items i JOIN employees e ON e.id = i.employee_id`;

export class PayrollRepository {
  static Instance = new PayrollRepository();
  private constructor() {}

  // ── Runs ───────────────────────────────────────────────────────────────────
  async listRuns(organizationId: string, f: { page: number; limit: number; status?: string; frequency?: string; year?: number }): Promise<PagedRows<PayrollRunDTO>> {
    const p = new SqlParams();
    const where = [`r.organization_id = ${p.add(organizationId)}`, "r.deleted_at IS NULL"];
    if (f.status) where.push(`r.status = ${p.add(f.status)}`);
    if (f.frequency) where.push(`r.frequency = ${p.add(f.frequency)}`);
    if (f.year) where.push(`EXTRACT(YEAR FROM r.period_start) = ${p.add(f.year)}`);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${RUN} WHERE ${where.join(" AND ")}) x
       ORDER BY x."periodStart" DESC, x."createdAt" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<PayrollRunDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findRun(organizationId: string, id: string, tx?: Tx): Promise<PayrollRunDTO | null> {
    const rows: PayrollRunDTO[] = await db(tx).query(`${RUN} WHERE r.organization_id = $1 AND r.id = $2 AND r.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  async overlappingRun(organizationId: string, frequency: string, start: string, end: string, branchId: string | null): Promise<string | null> {
    const rows: Array<{ code: string }> = await db().query(
      `SELECT code FROM payroll_runs WHERE organization_id = $1 AND deleted_at IS NULL AND status <> 'cancelled' AND frequency = $2
         AND period_start <= $4 AND period_end >= $3 AND (branch_id IS NULL OR $5::uuid IS NULL OR branch_id = $5) LIMIT 1`,
      [organizationId, frequency, start, end, branchId]
    );
    return rows[0]?.code ?? null;
  }

  async createRun(data: Omit<PayrollRun, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(PayrollRunEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async updateRun(id: string, data: Partial<PayrollRun>, tx: Tx): Promise<void> {
    await tx.getRepository(PayrollRunEntity).update({ id }, data);
  }

  async lockRun(id: string, tx: Tx): Promise<void> {
    await tx.query(`SELECT id FROM payroll_runs WHERE id = $1 FOR UPDATE`, [id]);
  }

  /** Recomputes the run totals from its items. */
  async refreshTotals(runId: string, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE payroll_runs r SET
         total_gross = COALESCE((SELECT SUM(gross_pay) FROM payroll_items WHERE run_id = r.id), 0),
         total_deductions = COALESCE((SELECT SUM(total_deductions) FROM payroll_items WHERE run_id = r.id), 0),
         total_net = COALESCE((SELECT SUM(net_pay) FROM payroll_items WHERE run_id = r.id), 0),
         total_paid = COALESCE((SELECT SUM(amount_paid) FROM payroll_items WHERE run_id = r.id), 0),
         updated_at = now()
       WHERE r.id = $1`,
      [runId]
    );
  }

  // ── Items ──────────────────────────────────────────────────────────────────
  async items(runId: string, tx?: Tx): Promise<PayrollItemDTO[]> {
    return db(tx).query(`${ITEM} WHERE i.run_id = $1 ORDER BY "employeeName"`, [runId]);
  }

  async findItem(runId: string, itemId: string, tx?: Tx): Promise<PayrollItemDTO | null> {
    const rows: PayrollItemDTO[] = await db(tx).query(`${ITEM} WHERE i.run_id = $1 AND i.id = $2`, [runId, itemId]);
    return rows[0] ?? null;
  }

  async insertItem(data: Omit<PayrollItem, "id" | "createdAt" | "updatedAt">, tx: Tx): Promise<void> {
    await tx.getRepository(PayrollItemEntity).insert(data);
  }

  async updateItem(id: string, data: Partial<PayrollItem>, tx: Tx): Promise<void> {
    await tx.getRepository(PayrollItemEntity).update({ id }, data);
  }

  async deleteItem(id: string, tx: Tx): Promise<void> {
    await tx.getRepository(PayrollItemEntity).delete({ id });
  }

  async lockItem(id: string, tx: Tx): Promise<void> {
    await tx.query(`SELECT id FROM payroll_items WHERE id = $1 FOR UPDATE`, [id]);
  }

  // ── Payments & payslips ────────────────────────────────────────────────────
  async insertPayment(data: Omit<PayrollPayment, "id" | "createdAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(PayrollPaymentEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async itemPayments(itemId: string, tx?: Tx): Promise<Array<{ date: string; method: string; reference: string | null; amount: number }>> {
    return db(tx).query(
      `SELECT payment_date AS date, method, reference, amount FROM payroll_payments WHERE payroll_item_id = $1 AND deleted_at IS NULL ORDER BY payment_date, created_at`,
      [itemId]
    );
  }

  /** Creates (or refreshes) the payslip for a payroll line and returns its id. */
  async insertPayslip(data: { organizationId: string; runId: string; payrollItemId: string; employeeId: string; code: string; snapshot: Record<string, unknown> }, tx: Tx): Promise<string> {
    const rows: Array<{ id: string }> = await tx.query(
      `INSERT INTO payslips (organization_id, run_id, payroll_item_id, employee_id, code, snapshot) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (payroll_item_id) DO UPDATE SET snapshot = EXCLUDED.snapshot
       RETURNING id`,
      [data.organizationId, data.runId, data.payrollItemId, data.employeeId, data.code, JSON.stringify(data.snapshot)]
    );
    return rows[0].id;
  }

  async payslipCodeForItem(itemId: string, tx: Tx): Promise<string | null> {
    const rows: Array<{ code: string }> = await tx.query(`SELECT code FROM payslips WHERE payroll_item_id = $1`, [itemId]);
    return rows[0]?.code ?? null;
  }

  async findPayslip(organizationId: string, id: string): Promise<PayslipDTO | null> {
    const rows: PayslipDTO[] = await db().query(
      `SELECT ps.id, ps.code, ps.run_id AS "runId", ps.payroll_item_id AS "payrollItemId", ps.employee_id AS "employeeId",
              e.first_name || ' ' || e.last_name AS "employeeName", ps.snapshot, ps.created_at AS "createdAt"
       FROM payslips ps JOIN employees e ON e.id = ps.employee_id WHERE ps.organization_id = $1 AND ps.id = $2`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async payslips(organizationId: string, f: { runId?: string; employeeId?: string; page: number; limit: number }): Promise<PagedRows<Omit<PayslipDTO, "snapshot"> & { netPay: number; period: string }>> {
    const p = new SqlParams();
    const where = [`ps.organization_id = ${p.add(organizationId)}`];
    if (f.runId) where.push(`ps.run_id = ${p.add(f.runId)}`);
    if (f.employeeId) where.push(`ps.employee_id = ${p.add(f.employeeId)}`);
    const rows = await db().query(
      `SELECT ps.id, ps.code, ps.run_id AS "runId", ps.payroll_item_id AS "payrollItemId", ps.employee_id AS "employeeId",
              e.first_name || ' ' || e.last_name AS "employeeName", (ps.snapshot->>'netPay')::bigint AS "netPay",
              ps.snapshot->>'period' AS period, ps.created_at AS "createdAt", COUNT(*) OVER() AS "__total"
       FROM payslips ps JOIN employees e ON e.id = ps.employee_id
       WHERE ${where.join(" AND ")} ORDER BY ps.created_at DESC
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows(rows, f.page, f.limit);
  }

  // ── Employee ledger ────────────────────────────────────────────────────────
  async employeeTotals(employeeId: string): Promise<{ earned: number; paid: number; owed: number }> {
    const rows: Array<{ earned: number; paid: number }> = await db().query(
      `SELECT COALESCE(SUM(i.net_pay), 0) AS earned, COALESCE(SUM(i.amount_paid), 0) AS paid
       FROM payroll_items i JOIN payroll_runs r ON r.id = i.run_id
       WHERE i.employee_id = $1 AND r.deleted_at IS NULL AND r.status IN ('approved', 'paid')`,
      [employeeId]
    );
    const earned = num(rows[0]?.earned);
    const paid = num(rows[0]?.paid);
    return { earned, paid, owed: earned - paid };
  }

  async employeeLedger(employeeId: string): Promise<Array<{ date: string; type: string; reference: string; description: string; earned: number; paid: number; loan: number }>> {
    return db().query(
      `SELECT * FROM (
         SELECT r.pay_date AS date, 'salary' AS type, r.code AS reference,
                'Net pay for ' || r.period_start || ' – ' || r.period_end AS description, i.net_pay AS earned, 0::bigint AS paid, 0::bigint AS loan
         FROM payroll_items i JOIN payroll_runs r ON r.id = i.run_id
         WHERE i.employee_id = $1 AND r.deleted_at IS NULL AND r.status IN ('approved', 'paid')
         UNION ALL
         SELECT pp.payment_date, 'payment', r.code, 'Salary paid (' || pp.method || ')' || COALESCE(' · ref ' || pp.reference, ''), 0, pp.amount, 0
         FROM payroll_payments pp JOIN payroll_runs r ON r.id = pp.run_id
         WHERE pp.employee_id = $1 AND pp.deleted_at IS NULL
         UNION ALL
         SELECT l.issue_date, l.type, l.code, initcap(l.type) || ' issued', 0, 0, l.principal
         FROM loans l WHERE l.employee_id = $1 AND l.deleted_at IS NULL
         UNION ALL
         SELECT lr.repayment_date, 'repayment', l.code,
                CASE WHEN lr.source = 'payroll' THEN 'Deducted from salary' ELSE 'Repaid (' || COALESCE(lr.method, 'cash') || ')' END, 0, 0, -lr.amount
         FROM loan_repayments lr JOIN loans l ON l.id = lr.loan_id WHERE l.employee_id = $1 AND lr.deleted_at IS NULL
       ) e ORDER BY e.date DESC LIMIT 500`,
      [employeeId]
    );
  }
}
