import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { EmployeeDocumentDTO, EmployeeDTO, PayrollEmployeeRow } from "../dto/employee.dto";
import { EmployeeEntity, type Employee } from "../entities/employee.entity";
import { EmployeeDocumentEntity, type EmployeeDocument } from "../entities/employeeDocument.entity";

const SELECT = `
  SELECT e.id, e.code, e.branch_id AS "branchId", b.name AS "branchName", e.user_id AS "userId", u.email AS "userEmail",
         e.first_name AS "firstName", e.last_name AS "lastName", e.first_name || ' ' || e.last_name AS "fullName",
         e.photo_url AS "photoUrl", e.photo_public_id AS "photoPublicId", e.phone, e.email, e.address, e.job_title AS "jobTitle",
         e.start_date AS "startDate", e.end_date AS "endDate", e.status, e.pay_frequency AS "payFrequency", e.salary,
         e.commission_rate_bps AS "commissionRateBps", e.bank_name AS "bankName", e.bank_account_number AS "bankAccountNumber",
         e.bank_account_name AS "bankAccountName", e.next_of_kin_name AS "nextOfKinName", e.next_of_kin_phone AS "nextOfKinPhone",
         e.next_of_kin_relationship AS "nextOfKinRelationship", e.next_of_kin_address AS "nextOfKinAddress",
         e.guarantor_name AS "guarantorName", e.guarantor_phone AS "guarantorPhone", e.guarantor_address AS "guarantorAddress",
         e.guarantor_relationship AS "guarantorRelationship", e.guarantor_occupation AS "guarantorOccupation", e.notes,
         e.created_at AS "createdAt"
  FROM employees e
  JOIN branches b ON b.id = e.branch_id
  LEFT JOIN users u ON u.id = e.user_id`;

export class EmployeeRepository {
  static Instance = new EmployeeRepository();
  private constructor() {}

  async list(
    organizationId: string,
    f: { page: number; limit: number; search?: string; branchId: string | null; status?: string; payFrequency?: string }
  ): Promise<PagedRows<EmployeeDTO>> {
    const p = new SqlParams();
    const where = [`e.organization_id = ${p.add(organizationId)}`, "e.deleted_at IS NULL"];
    if (f.branchId) where.push(`e.branch_id = ${p.add(f.branchId)}`);
    if (f.status) where.push(`e.status = ${p.add(f.status)}`);
    if (f.payFrequency) where.push(`e.pay_frequency = ${p.add(f.payFrequency)}`);
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(e.first_name ILIKE ${s} OR e.last_name ILIKE ${s} OR e.code ILIKE ${s} OR e.phone ILIKE ${s} OR e.job_title ILIKE ${s})`);
    }
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT} WHERE ${where.join(" AND ")}) x
       ORDER BY x."firstName", x."lastName" LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<EmployeeDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<EmployeeDTO | null> {
    const rows: EmployeeDTO[] = await db(tx).query(`${SELECT} WHERE e.organization_id = $1 AND e.id = $2 AND e.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  async findByUserId(organizationId: string, userId: string, tx?: Tx): Promise<EmployeeDTO | null> {
    const rows: EmployeeDTO[] = await db(tx).query(`${SELECT} WHERE e.organization_id = $1 AND e.user_id = $2 AND e.deleted_at IS NULL`, [organizationId, userId]);
    return rows[0] ?? null;
  }

  /** Employee-specific commission rate for the staff member who made a sale (null = use the business default). */
  async commissionRateForUser(organizationId: string, userId: string, tx?: Tx): Promise<number | null> {
    const rows: Array<{ rate: number | null }> = await db(tx).query(
      `SELECT commission_rate_bps AS rate FROM employees WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL AND status = 'active'`,
      [organizationId, userId]
    );
    return rows[0]?.rate ?? null;
  }

  /** Active employees on this pay frequency who had started by the end of the period. */
  async forPayroll(organizationId: string, frequency: string, periodStart: string, periodEnd: string, branchId: string | null, tx: Tx): Promise<PayrollEmployeeRow[]> {
    return tx.query(
      `SELECT e.id, e.code, e.first_name || ' ' || e.last_name AS "fullName", e.user_id AS "userId", e.branch_id AS "branchId",
              e.salary, e.pay_frequency AS "payFrequency", e.job_title AS "jobTitle", e.bank_name AS "bankName",
              e.bank_account_number AS "bankAccountNumber", e.bank_account_name AS "bankAccountName"
       FROM employees e
       WHERE e.organization_id = $1 AND e.deleted_at IS NULL AND e.pay_frequency = $2 AND e.status <> 'terminated'
         AND e.start_date <= $4 AND (e.end_date IS NULL OR e.end_date >= $3) AND ($5::uuid IS NULL OR e.branch_id = $5)
       ORDER BY e.first_name, e.last_name`,
      [organizationId, frequency, periodStart, periodEnd, branchId]
    );
  }

  async userLinkedElsewhere(organizationId: string, userId: string, exceptId?: string): Promise<boolean> {
    const rows: Array<{ id: string }> = await db().query(
      `SELECT id FROM employees WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [organizationId, userId, exceptId ?? null]
    );
    return rows.length > 0;
  }

  async create(data: Omit<Employee, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(EmployeeEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<Employee>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(EmployeeEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(EmployeeEntity).softDelete({ id, organizationId });
  }

  async hasPayroll(id: string): Promise<boolean> {
    const rows: Array<{ exists: boolean }> = await db().query(
      `SELECT (EXISTS (SELECT 1 FROM payroll_items i JOIN payroll_runs r ON r.id = i.run_id WHERE i.employee_id = $1 AND r.deleted_at IS NULL AND r.status <> 'cancelled')
            OR EXISTS (SELECT 1 FROM loans WHERE employee_id = $1 AND deleted_at IS NULL AND status = 'active')) AS exists`,
      [id]
    );
    return Boolean(rows[0]?.exists);
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  async documents(employeeId: string): Promise<EmployeeDocumentDTO[]> {
    return db().query(
      `SELECT d.id, d.name, d.category, d.url, d.public_id AS "publicId", d.mime_type AS "mimeType", u.name AS "uploadedByName", d.created_at AS "createdAt"
       FROM employee_documents d LEFT JOIN users u ON u.id = d.uploaded_by_id
       WHERE d.employee_id = $1 AND d.deleted_at IS NULL ORDER BY d.created_at DESC LIMIT 100`,
      [employeeId]
    );
  }

  async findDocument(employeeId: string, documentId: string): Promise<EmployeeDocumentDTO | null> {
    const docs = await this.documents(employeeId);
    return docs.find((d) => d.id === documentId) ?? null;
  }

  async addDocument(data: Omit<EmployeeDocument, "id" | "createdAt" | "deletedAt">): Promise<void> {
    await db().getRepository(EmployeeDocumentEntity).insert(data);
  }

  async removeDocument(documentId: string): Promise<void> {
    await db().getRepository(EmployeeDocumentEntity).softDelete({ id: documentId });
  }
}
