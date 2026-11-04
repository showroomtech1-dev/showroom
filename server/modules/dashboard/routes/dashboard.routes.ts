import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { DashboardController } from "../controllers/dashboard.controller";
import { chartsSchema, dashboardSchema } from "../validators/dashboard.schema";

/** /api/v1/dashboard */
const router = Router();
router.use(authMiddleware);

router.get("/", requirePermission("dashboard.read"), validate(dashboardSchema), DashboardController.summary);
router.get("/charts", requirePermission("dashboard.read"), validate(chartsSchema), DashboardController.charts);

export default router;
