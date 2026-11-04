import { z } from "zod";
import { emptyObject, uuid } from "../../../shared/validation/common";
import { RESTORABLE, type RestorableType } from "../repositories/system.repository";

const restorableType = z.enum(Object.keys(RESTORABLE) as [RestorableType, ...RestorableType[]]);

export const trashListSchema = z.object({
  query: z.object({ type: restorableType, limit: z.coerce.number().int().min(1).max(200).default(50) }),
});

export const restoreSchema = z.object({
  params: z.object({ type: restorableType, id: uuid }),
  body: emptyObject.optional(),
});
