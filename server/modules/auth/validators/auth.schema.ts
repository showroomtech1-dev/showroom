import { z } from "zod";
import { PASSWORD_RULE } from "../../../shared/utils/password";
import { email, phone, requiredText } from "../../../shared/validation/common";

export const passwordField = z
  .string()
  .regex(PASSWORD_RULE, "Password must be 8–72 characters and include a letter and a number");

export const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1, "Password is required").max(200),
  }),
});

export const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string().min(20).max(200) }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(200),
    newPassword: passwordField,
  }),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: requiredText(120),
      phone: phone.optional().nullable(),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const forgotPasswordSchema = z.object({ body: z.object({ email }) });

export const resetPasswordWithCodeSchema = z.object({
  body: z.object({
    email,
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email"),
    newPassword: passwordField,
  }),
});

export type LoginInput = z.infer<typeof loginSchema>["body"];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>["body"];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
export type ResetPasswordWithCodeInput = z.infer<typeof resetPasswordWithCodeSchema>["body"];
