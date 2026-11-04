import { z } from "zod";
import { uuid } from "../../../shared/validation/common";

export const dashboardSchema = z.object({ query: z.object({ branchId: uuid.optional() }) });

export const chartsSchema = z.object({
  query: z.object({
    branchId: uuid.optional(),
    days: z.coerce.number().int().min(7).max(366).default(30),
    months: z.coerce.number().int().min(1).max(36).default(12),
  }),
});
