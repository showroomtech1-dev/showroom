import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { QuotationEntity, type Quotation } from "../entities/quotation.entity";
import { QuotationItemEntity, type QuotationItem } from "../entities/quotationItem.entity";

export interface QuotationDTO {
  id: string;
  code: string;
  branchId: string;
  branchName: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  quoteDate: string;
  validUntil: string | null;
  subtotal: number;
  discountTotal: number;
  taxRateBps: number;
  taxAmount: number;
  total: number;
  status: string;
  notes: string | null;
  terms: string | null;
  convertedSaleId: string | null;
  createdByName: string | null;
  createdAt: Date;
  items?: QuotationItemDTO[];
}

export interface QuotationItemDTO {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

const SELECT = `
  SELECT q.id, q.code, q.branch_id AS "branchId", b.name AS "branchName", q.customer_id AS "customerId",
         COALESCE(c.name, q.customer_name) AS "customerName", COALESCE(c.phone, q.customer_phone) AS "customerPhone",
         q.quote_date AS "quoteDate", q.valid_until AS "validUntil", q.subtotal, q.discount_total AS "discountTotal",
         q.tax_rate_bps AS "taxRateBps", q.tax_amount AS "taxAmount", q.total,
         CASE WHEN q.status IN ('draft', 'sent') AND q.valid_until < CURRENT_DATE THEN 'expired' ELSE q.status END AS status,
         q.notes, q.terms, q.converted_sale_id AS "convertedSaleId", u.name AS "createdByName", q.created_at AS "createdAt"
  FROM quotations q
  JOIN branches b ON b.id = q.branch_id
  LEFT JOIN customers c ON c.id = q.customer_id
  LEFT JOIN users u ON u.id = q.created_by_id`;

export class QuotationRepository {
  static Instance = new QuotationRepository();
  private constructor() {}

  async list(
    organizationId: string,
    f: { page: number; limit: number; search?: string; status?: string; customerId?: string; branchId: string | null; from?: string; to?: string }
  ): Promise<PagedRows<QuotationDTO>> {
    const p = new SqlParams();
    const where = [`q.organization_id = ${p.add(organizationId)}`, "q.deleted_at IS NULL"];
    if (f.customerId) where.push(`q.customer_id = ${p.add(f.customerId)}`);
    if (f.branchId) where.push(`q.branch_id = ${p.add(f.branchId)}`);
    if (f.from) where.push(`q.quote_date >= ${p.add(f.from)}`);
    if (f.to) where.push(`q.quote_date <= ${p.add(f.to)}`);
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(q.code ILIKE ${s} OR q.customer_name ILIKE ${s} OR c.name ILIKE ${s})`);
    }
    const statusWhere = f.status ? `WHERE x.status = ${p.add(f.status)}` : "";
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT} WHERE ${where.join(" AND ")}) x ${statusWhere}
       ORDER BY x."quoteDate" DESC, x."createdAt" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<QuotationDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<QuotationDTO | null> {
    const rows: QuotationDTO[] = await db(tx).query(`${SELECT} WHERE q.organization_id = $1 AND q.id = $2 AND q.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  async items(quotationId: string, tx?: Tx): Promise<QuotationItemDTO[]> {
    return db(tx).query(
      `SELECT id, variant_id AS "variantId", product_id AS "productId", product_name AS "productName", variant_name AS "variantName",
              quantity, unit_price AS "unitPrice", discount, line_total AS "lineTotal"
       FROM quotation_items WHERE quotation_id = $1 ORDER BY product_name`,
      [quotationId]
    );
  }

  async create(data: Omit<Quotation, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx: Tx): Promise<string> {
    const repo = tx.getRepository(QuotationEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async replaceItems(quotationId: string, items: Array<Omit<QuotationItem, "id" | "quotationId">>, tx: Tx): Promise<void> {
    await tx.getRepository(QuotationItemEntity).delete({ quotationId });
    if (items.length > 0) await tx.getRepository(QuotationItemEntity).insert(items.map((i) => ({ ...i, quotationId })));
  }

  async update(organizationId: string, id: string, data: Partial<Quotation>, tx: Tx): Promise<void> {
    await tx.getRepository(QuotationEntity).update({ id, organizationId }, data);
  }

  async lock(id: string, tx: Tx): Promise<void> {
    await tx.query(`SELECT id FROM quotations WHERE id = $1 FOR UPDATE`, [id]);
  }

  async softDelete(organizationId: string, id: string, tx: Tx): Promise<void> {
    await tx.getRepository(QuotationEntity).softDelete({ id, organizationId });
  }
}
