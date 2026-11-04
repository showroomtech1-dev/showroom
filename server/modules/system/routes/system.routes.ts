import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { SystemController } from "../controllers/system.controller";
import { restoreSchema, trashListSchema } from "../validators/system.schema";

/** /api/v1/system */
const router = Router();
router.use(authMiddleware);

router.get("/backup", requirePermission("backup.manage"), SystemController.backup);
router.get("/trash/types", requirePermission("trash.manage"), SystemController.trashTypes);
router.get("/trash", requirePermission("trash.manage"), validate(trashListSchema), SystemController.trash);
router.post("/trash/:type/:id/restore", requirePermission("trash.manage"), validate(restoreSchema), SystemController.restore);

export default router;
