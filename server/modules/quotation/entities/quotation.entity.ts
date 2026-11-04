// Quotation / proforma invoice. No stock or money moves until it is converted to a sale.
import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  intColumn,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Quotation {
  id: string;
  organizationId: string;
  branchId: string;
  code: string;
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
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  customer?: { id: string };
}

export const QuotationEntity = new EntitySchema<Quotation>({
  name: "Quotation",
  tableName: "quotations",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    code: varchar("code", 24),
    customerId: uuidColumn("customer_id", true),
    customerName: varchar("customer_name", 160, true),
    customerPhone: varchar("customer_phone", 30, true),
    quoteDate: dateColumn("quote_date"),
    validUntil: dateColumn("valid_until", true),
    subtotal: moneyColumn("subtotal"),
    discountTotal: moneyColumn("discount_total"),
    taxRateBps: intColumn("tax_rate_bps", 0),
    taxAmount: moneyColumn("tax_amount"),
    total: moneyColumn("total"),
    status: varchar("status", 12, false, "draft"),
    notes: textColumn("notes"),
    terms: textColumn("terms"),
    convertedSaleId: uuidColumn("converted_sale_id", true),
    createdById: uuidColumn("created_by_id", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    customer: manyToOne("Customer", "customer_id", "SET NULL"),
  },
  indices: [
    { name: "IDX_quotations_org_date", columns: ["organizationId", "quoteDate"] },
    { name: "IDX_quotations_org_status", columns: ["organizationId", "status"] },
    { name: "UQ_quotations_org_code", columns: ["organizationId", "code"], unique: true },
  ],
});
