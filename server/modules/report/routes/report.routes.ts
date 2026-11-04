import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { ReportController } from "../controllers/report.controller";
import { reportSchema } from "../validators/report.schema";

/** /api/v1/reports — ?format=json|csv|xlsx|pdf (exports need report.export). */
const router = Router();
router.use(authMiddleware);

router.get("/", requirePermission("report.read"), ReportController.types);
router.get("/:type", requirePermission("report.read"), validate(reportSchema), ReportController.run);

export default router;
