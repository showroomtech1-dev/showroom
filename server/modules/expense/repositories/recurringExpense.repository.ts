import { db, type Tx } from "../../../infrastructure/database/transaction";
import type { RecurringExpenseDTO } from "../dto/expense.dto";
import { RecurringExpenseEntity, type RecurringExpense } from "../entities/recurringExpense.entity";

const SELECT = (today: string) => `
  SELECT r.id, r.branch_id AS "branchId", b.name AS "branchName", r.category_id AS "categoryId", c.name AS "categoryName",
         r.name, r.amount, r.method, r.account_id AS "accountId", r.payee, r.supplier_id AS "supplierId", r.frequency,
         r.start_date AS "startDate", r.next_due_date AS "nextDueDate", r.end_date AS "endDate", r.is_active AS "isActive",
         r.last_recorded_at AS "lastRecordedAt", r.notes, (r.next_due_date - ${today}::date) AS "daysUntilDue"
  FROM recurring_expenses r
  JOIN branches b ON b.id = r.branch_id
  JOIN expense_categories c ON c.id = r.category_id`;

export class RecurringExpenseRepository {
  static Instance = new RecurringExpenseRepository();
  private constructor() {}

  async list(organizationId: string, today: string, opts: { branchId: string | null; includeInactive: boolean }): Promise<RecurringExpenseDTO[]> {
    return db().query(
      `${SELECT("$2")} WHERE r.organization_id = $1 AND r.deleted_at IS NULL AND ($3::boolean OR r.is_active)
         AND ($4::uuid IS NULL OR r.branch_id = $4)
       ORDER BY r.is_active DESC, r.next_due_date LIMIT 200`,
      [organizationId, today, opts.includeInactive, opts.branchId]
    );
  }

  async findById(organizationId: string, id: string, today: string, tx?: Tx): Promise<RecurringExpenseDTO | null> {
    const rows: RecurringExpenseDTO[] = await db(tx).query(
      `${SELECT("$3")} WHERE r.organization_id = $1 AND r.id = $2 AND r.deleted_at IS NULL`,
      [organizationId, id, today]
    );
    return rows[0] ?? null;
  }

  /** Active recurring expenses due on or before `until`. */
  async due(organizationId: string, today: string, until: string): Promise<RecurringExpenseDTO[]> {
    return db().query(
      `${SELECT("$2")} WHERE r.organization_id = $1 AND r.deleted_at IS NULL AND r.is_active
         AND r.next_due_date <= $3 AND (r.end_date IS NULL OR r.next_due_date <= r.end_date)
       ORDER BY r.next_due_date LIMIT 200`,
      [organizationId, today, until]
    );
  }

  async create(data: Omit<RecurringExpense, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(RecurringExpenseEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<RecurringExpense>, tx: Tx): Promise<void> {
    await tx.getRepository(RecurringExpenseEntity).update({ id, organizationId }, data);
  }

  async lock(id: string, tx: Tx): Promise<void> {
    await tx.query(`SELECT id FROM recurring_expenses WHERE id = $1 FOR UPDATE`, [id]);
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(RecurringExpenseEntity).softDelete({ id, organizationId });
  }
}
