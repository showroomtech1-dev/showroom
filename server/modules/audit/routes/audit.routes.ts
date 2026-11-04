import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { AuditController } from "../controllers/audit.controller";
import { listAuditSchema } from "../validators/audit.schema";

const router = Router();
router.use(authMiddleware);

router.get("/", requirePermission("audit.read"), validate(listAuditSchema), AuditController.list);

export default router;
