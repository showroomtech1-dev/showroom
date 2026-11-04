import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { num } from "../../../shared/utils/money";
import type { ExpenseCategoryDTO, ExpenseDTO, ExpenseGroupRow } from "../dto/expense.dto";
import { ExpenseEntity, type Expense } from "../entities/expense.entity";
import { ExpenseCategoryEntity } from "../entities/expenseCategory.entity";

const SELECT = `
  SELECT e.id, e.code, e.branch_id AS "branchId", b.name AS "branchName", e.expense_date AS "expenseDate",
         e.category_id AS "categoryId", c.name AS "categoryName", e.amount, e.method, e.account_id AS "accountId",
         a.name AS "accountName", e.payee, e.supplier_id AS "supplierId", s.name AS "supplierName", e.description,
         e.receipt_url AS "receiptUrl", e.receipt_public_id AS "receiptPublicId", e.recurring_expense_id AS "recurringExpenseId",
         u.name AS "createdByName", e.created_at AS "createdAt"
  FROM expenses e
  JOIN branches b ON b.id = e.branch_id
  JOIN expense_categories c ON c.id = e.category_id
  JOIN accounts a ON a.id = e.account_id
  LEFT JOIN suppliers s ON s.id = e.supplier_id
  LEFT JOIN users u ON u.id = e.created_by_id`;

export interface ExpenseFilter {
  page: number;
  limit: number;
  search?: string;
  branchId: string | null;
  categoryId?: string;
  supplierId?: string;
  method?: string;
  payee?: string;
  from?: string;
  to?: string;
}

function filterWhere(p: SqlParams, organizationId: string, f: Omit<ExpenseFilter, "page" | "limit">): string[] {
  const where = [`e.organization_id = ${p.add(organizationId)}`, "e.deleted_at IS NULL"];
  if (f.branchId) where.push(`e.branch_id = ${p.add(f.branchId)}`);
  if (f.categoryId) where.push(`e.category_id = ${p.add(f.categoryId)}`);
  if (f.supplierId) where.push(`e.supplier_id = ${p.add(f.supplierId)}`);
  if (f.method) where.push(`e.method = ${p.add(f.method)}`);
  if (f.payee) where.push(`e.payee ILIKE ${p.add(likePattern(f.payee))}`);
  if (f.from) where.push(`e.expense_date >= ${p.add(f.from)}`);
  if (f.to) where.push(`e.expense_date <= ${p.add(f.to)}`);
  if (f.search) {
    const s = p.add(likePattern(f.search));
    where.push(`(e.code ILIKE ${s} OR e.payee ILIKE ${s} OR e.description ILIKE ${s})`);
  }
  return where;
}

export class ExpenseRepository {
  static Instance = new ExpenseRepository();
  private constructor() {}

  // ── Categories ─────────────────────────────────────────────────────────────
  async categories(organizationId: string, includeInactive: boolean): Promise<ExpenseCategoryDTO[]> {
    return db().query(
      `SELECT c.id, c.name, c.is_system AS "isSystem", c.is_active AS "isActive",
              (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id AND e.deleted_at IS NULL)::int AS "expenseCount"
       FROM expense_categories c
       WHERE c.organization_id = $1 AND c.deleted_at IS NULL AND ($2::boolean OR c.is_active)
       ORDER BY c.is_system DESC, c.name LIMIT 200`,
      [organizationId, includeInactive]
    );
  }

  async findCategory(organizationId: string, id: string, tx?: Tx): Promise<ExpenseCategoryDTO | null> {
    const rows: ExpenseCategoryDTO[] = await db(tx).query(
      `SELECT c.id, c.name, c.is_system AS "isSystem", c.is_active AS "isActive",
              (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id AND e.deleted_at IS NULL)::int AS "expenseCount"
       FROM expense_categories c WHERE c.organization_id = $1 AND c.id = $2 AND c.deleted_at IS NULL`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async categoryNameTaken(organizationId: string, name: string, exceptId?: string): Promise<boolean> {
    const rows: Array<{ id: string }> = await db().query(
      `SELECT id FROM expense_categories WHERE organization_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL
         AND ($3::uuid IS NULL OR id <> $3::uuid) LIMIT 1`,
      [organizationId, name, exceptId ?? null]
    );
    return rows.length > 0;
  }

  async createCategory(organizationId: string, name: string, isSystem: boolean, tx?: Tx): Promise<string> {
    const repo = db(tx).getRepository(ExpenseCategoryEntity);
    const saved = await repo.save(repo.create({ organizationId, name, isSystem, isActive: true }));
    return saved.id;
  }

  async updateCategory(organizationId: string, id: string, data: { name?: string; isActive?: boolean }, tx?: Tx): Promise<void> {
    await db(tx).getRepository(ExpenseCategoryEntity).update({ id, organizationId }, data);
  }

  async deleteCategory(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(ExpenseCategoryEntity).softDelete({ id, organizationId });
  }

  // ── Expenses ───────────────────────────────────────────────────────────────
  async list(organizationId: string, f: ExpenseFilter): Promise<PagedRows<ExpenseDTO> & { total: number }> {
    const p = new SqlParams();
    const where = filterWhere(p, organizationId, f);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total", SUM(x.amount) OVER() AS "__sum" FROM (${SELECT} WHERE ${where.join(" AND ")}) x
       ORDER BY x."expenseDate" DESC, x."createdAt" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    const total = rows.length > 0 ? num(rows[0].__sum) : 0;
    const paged = fromWindowedRows<ExpenseDTO & Record<string, unknown>>(rows.map(({ __sum: _s, ...r }: Record<string, unknown>) => r), f.page, f.limit);
    return { ...paged, total };
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<ExpenseDTO | null> {
    const rows: ExpenseDTO[] = await db(tx).query(`${SELECT} WHERE e.organization_id = $1 AND e.id = $2 AND e.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  async findIdByClientRef(organizationId: string, clientRef: string): Promise<string | null> {
    const row = await db().getRepository(ExpenseEntity).findOne({ where: { organizationId, clientRef }, select: ["id"], withDeleted: true });
    return row?.id ?? null;
  }

  async create(data: Omit<Expense, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(ExpenseEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<Expense>, tx: Tx): Promise<void> {
    await tx.getRepository(ExpenseEntity).update({ id, organizationId }, data);
  }

  async lock(id: string, tx: Tx): Promise<void> {
    await tx.query(`SELECT id FROM expenses WHERE id = $1 FOR UPDATE`, [id]);
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(ExpenseEntity).softDelete({ id, organizationId });
  }

  // ── Reports ────────────────────────────────────────────────────────────────
  async grouped(organizationId: string, by: "category" | "payee" | "day" | "week" | "month" | "method", f: Omit<ExpenseFilter, "page" | "limit">): Promise<ExpenseGroupRow[]> {
    const p = new SqlParams();
    const where = filterWhere(p, organizationId, f);
    const keyExpr: Record<typeof by, { key: string; label: string; join: string }> = {
      category: { key: "c.id::text", label: "c.name", join: "JOIN expense_categories c ON c.id = e.category_id" },
      payee: { key: "COALESCE(s.name, e.payee, 'Unspecified')", label: "COALESCE(s.name, e.payee, 'Unspecified')", join: "LEFT JOIN suppliers s ON s.id = e.supplier_id" },
      method: { key: "e.method", label: "e.method", join: "" },
      day: { key: "e.expense_date::text", label: "e.expense_date::text", join: "" },
      week: { key: "to_char(date_trunc('week', e.expense_date), 'YYYY-MM-DD')", label: "'Week of ' || to_char(date_trunc('week', e.expense_date), 'DD Mon YYYY')", join: "" },
      month: { key: "to_char(e.expense_date, 'YYYY-MM')", label: "to_char(e.expense_date, 'Mon YYYY')", join: "" },
    };
    const k = keyExpr[by];
    const order = by === "day" || by === "week" || by === "month" ? "key" : "total DESC";
    const rows: ExpenseGroupRow[] = await db().query(
      `SELECT ${k.key} AS key, ${k.label} AS label, COUNT(*) AS count, SUM(e.amount) AS total
       FROM expenses e ${k.join} WHERE ${where.join(" AND ")}
       GROUP BY 1, 2 ORDER BY ${order} LIMIT 500`,
      p.values
    );
    return rows.map((r) => ({ ...r, count: num(r.count), total: num(r.total) }));
  }
}
