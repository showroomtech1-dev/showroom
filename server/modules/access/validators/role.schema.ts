import { z } from "zod";
import { PERMISSION_CODES, type PermissionCode } from "../catalog/permissions.catalog";
import { optionalText, requiredText, uuid } from "../../../shared/validation/common";

const permissionList = z
  .array(z.enum(PERMISSION_CODES as [PermissionCode, ...PermissionCode[]]))
  .max(100)
  .transform((codes) => Array.from(new Set(codes)));

export const createRoleSchema = z.object({
  body: z.object({
    name: requiredText(80),
    description: optionalText(500),
    permissions: permissionList,
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      name: requiredText(80),
      description: optionalText(500),
      permissions: permissionList,
    })
    .partial(),
});

export const roleIdSchema = z.object({ params: z.object({ id: uuid }) });

export type CreateRoleInput = z.infer<typeof createRoleSchema>["body"];
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>["body"];
