import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { UserController } from "../controllers/user.controller";
import {
  createUserSchema,
  listUsersSchema,
  lookupUsersSchema,
  resetPasswordSchema,
  updateUserSchema,
  userIdSchema,
} from "../validators/user.schema";

const router = Router();
router.use(authMiddleware);

router.get(
  "/lookup",
  requireAny("user.manage", "sale.readall", "report.read", "employee.manage", "cashup.manage"),
  validate(lookupUsersSchema),
  UserController.lookup
);
router.get("/", requirePermission("user.manage"), validate(listUsersSchema), UserController.list);
router.get("/:id", requirePermission("user.manage"), validate(userIdSchema), UserController.get);
router.post("/", requirePermission("user.manage"), validate(createUserSchema), UserController.create);
router.patch("/:id", requirePermission("user.manage"), validate(updateUserSchema), UserController.update);
router.post("/:id/reset-password", requirePermission("user.manage"), validate(resetPasswordSchema), UserController.resetPassword);
router.delete("/:id", requirePermission("user.manage"), validate(userIdSchema), UserController.remove);

export default router;
