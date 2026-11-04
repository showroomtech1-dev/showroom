import { z } from "zod";
import { emptyObject, pageQuery, queryBool, uuid } from "../../../shared/validation/common";

export const listNotificationsSchema = z.object({
  query: z.object({ page: pageQuery.page, limit: pageQuery.limit, unreadOnly: queryBool.optional() }),
});

export const notificationIdSchema = z.object({ params: z.object({ id: uuid }), body: emptyObject.optional() });

export const scanSchema = z.object({ body: emptyObject.optional() });
