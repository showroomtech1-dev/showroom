import { Router } from "express";
import { requirePlatformAdmin } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { PlatformController } from "../controllers/platform.controller";
import { businessListSchema, loginListSchema, overviewSchema, userListSchema } from "../validators/platform.schema";

/** /api/v1/platform — platform operators only (PLATFORM_ADMIN_EMAILS). */
const router = Router();
router.use(authMiddleware);

router.get("/overview", requirePlatformAdmin(), validate(overviewSchema), PlatformController.overview);
router.get("/businesses", requirePlatformAdmin(), validate(businessListSchema), PlatformController.businesses);
router.get("/users", requirePlatformAdmin(), validate(userListSchema), PlatformController.users);
router.get("/online", requirePlatformAdmin(), PlatformController.online);
router.get("/logins", requirePlatformAdmin(), validate(loginListSchema), PlatformController.logins);

export default router;
