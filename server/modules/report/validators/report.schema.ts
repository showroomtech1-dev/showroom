import { z } from "zod";
import { dateRangeQuery, exportFormat, uuid } from "../../../shared/validation/common";

export const REPORT_TYPES = [
  "sales",
  "sales-by-product",
  "sales-by-staff",
  "inventory",
  "expenses",
  "payroll",
  "profit-and-loss",
  "cash-flow",
  "debtors",
  "creditors",
  "supplier-statement",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const reportSchema = z.object({
  params: z.object({ type: z.enum(REPORT_TYPES) }),
  query: z
    .object({
      ...dateRangeQuery,
      format: exportFormat,
      branchId: uuid.optional(),
      staffId: uuid.optional(),
      productId: uuid.optional(),
      customerId: uuid.optional(),
      supplierId: uuid.optional(),
      categoryId: uuid.optional(),
    }),
});

export type ReportQuery = z.infer<typeof reportSchema>["query"];
