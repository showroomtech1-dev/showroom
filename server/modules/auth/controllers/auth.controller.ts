import type { Request } from "express";
import { actorOf, handle, input } from "../../../shared/http/handler";
import type { ClientContext } from "../dto/auth.dto";
import { AuthService } from "../services/auth.service";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordWithCodeSchema,
  updateProfileSchema,
} from "../validators/auth.schema";

const client = (req: Request): ClientContext => ({ userAgent: req.get("user-agent") ?? null, ip: req.ip ?? null });

export class AuthController {
  static login = handle("Signed in", (req) => AuthService.Instance.login(input(req, loginSchema).body, client(req)));

  static refresh = handle("Session refreshed", (req) =>
    AuthService.Instance.refresh(input(req, refreshSchema).body.refreshToken, client(req))
  );

  static logout = handle("Signed out", (req) => AuthService.Instance.logout(input(req, refreshSchema).body.refreshToken));

  static me = handle("Session fetched", (req) => AuthService.Instance.session(actorOf(req)));

  static updateMe = handle("Profile updated", (req) =>
    AuthService.Instance.updateProfile(actorOf(req), input(req, updateProfileSchema).body)
  );

  static forgotPassword = handle("Reset code requested", (req) => AuthService.Instance.forgotPassword(input(req, forgotPasswordSchema).body.email));

  static resetPassword = handle("Password reset", (req) => AuthService.Instance.resetPasswordWithCode(input(req, resetPasswordWithCodeSchema).body));

  static changePassword = handle("Password changed", (req) =>
    AuthService.Instance.changePassword(actorOf(req), input(req, changePasswordSchema).body, client(req))
  );
}
