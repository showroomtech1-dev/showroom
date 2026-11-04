import { Router } from "express";
import { publicRoute, requireAuthenticatedOnly } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { authRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { AuthController } from "../controllers/auth.controller";
import { changePasswordSchema, loginSchema, refreshSchema, updateProfileSchema } from "../validators/auth.schema";

const router = Router();

router.post("/login", publicRoute("sign-in"), authRateLimiter, validate(loginSchema), AuthController.login);
router.post("/refresh", publicRoute("token refresh"), authRateLimiter, validate(refreshSchema), AuthController.refresh);
router.post("/logout", publicRoute("revoke refresh token"), validate(refreshSchema), AuthController.logout);

router.get("/me", authMiddleware, requireAuthenticatedOnly(), AuthController.me);
router.patch("/me", authMiddleware, requireAuthenticatedOnly(), validate(updateProfileSchema), AuthController.updateMe);
router.post(
  "/change-password",
  authMiddleware,
  requireAuthenticatedOnly(),
  authRateLimiter,
  validate(changePasswordSchema),
  AuthController.changePassword
);

export default router;
