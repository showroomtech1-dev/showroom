import { z } from "zod";
import { dateRangeQuery, pageQuery, uuid } from "../../../shared/validation/common";

export const listAuditSchema = z.object({
  query: z.object({
    page: pageQuery.page,
    limit: pageQuery.limit,
    entityType: z.string().trim().max(60).optional(),
    entityId: uuid.optional(),
    userId: uuid.optional(),
    action: z.string().trim().max(40).optional(),
    ...dateRangeQuery,
  }),
});

export type ListAuditQuery = z.infer<typeof listAuditSchema>["query"];
