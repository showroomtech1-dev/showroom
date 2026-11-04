import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { RoleController } from "../controllers/role.controller";
import { createRoleSchema, roleIdSchema, updateRoleSchema } from "../validators/role.schema";

const router = Router();
router.use(authMiddleware);

router.get("/permissions", requireAny("role.manage", "user.manage"), RoleController.catalog);
router.get("/", requireAny("role.manage", "user.manage"), RoleController.list);
router.post("/", requirePermission("role.manage"), validate(createRoleSchema), RoleController.create);
router.patch("/:id", requirePermission("role.manage"), validate(updateRoleSchema), RoleController.update);
router.delete("/:id", requirePermission("role.manage"), validate(roleIdSchema), RoleController.remove);

export default router;
