import { z } from "zod";
import { dateRangeQuery, uuid } from "../../../shared/validation/common";

export const periodSchema = z.object({ query: z.object({ ...dateRangeQuery, branchId: uuid.optional() }) });

export const trendSchema = z.object({
  query: z.object({ months: z.coerce.number().int().min(1).max(36).default(12), branchId: uuid.optional() }),
});
