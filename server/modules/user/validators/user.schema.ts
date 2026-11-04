import { z } from "zod";
import { passwordField } from "../../auth/validators/auth.schema";
import { email, pageQuery, phone, queryBool, requiredText, uuid } from "../../../shared/validation/common";

export const listUsersSchema = z.object({
  query: z.object({
    ...pageQuery,
    roleId: uuid.optional(),
    branchId: uuid.optional(),
    isActive: queryBool.optional(),
  }),
});

export const lookupUsersSchema = z.object({
  query: z.object({ branchId: uuid.optional() }),
});

export const createUserSchema = z.object({
  body: z.object({
    name: requiredText(120),
    email,
    phone: phone.optional().nullable(),
    password: passwordField,
    roleId: uuid,
    branchId: uuid.optional().nullable(),
    mustChangePassword: z.boolean().default(true),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      name: requiredText(120),
      phone: phone.optional().nullable(),
      roleId: uuid,
      branchId: uuid.nullable(),
      isActive: z.boolean(),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const resetPasswordSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ password: passwordField, mustChangePassword: z.boolean().default(true) }),
});

export const userIdSchema = z.object({ params: z.object({ id: uuid }) });

export type ListUsersQuery = z.infer<typeof listUsersSchema>["query"];
export type CreateUserInput = z.infer<typeof createUserSchema>["body"];
export type UpdateUserInput = z.infer<typeof updateUserSchema>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
