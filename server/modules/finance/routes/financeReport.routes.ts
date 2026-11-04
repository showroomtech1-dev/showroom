import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { FinanceReportController } from "../controllers/financeReport.controller";
import { periodSchema, trendSchema } from "../validators/financeReport.schema";

/** /api/v1/finance */
const router = Router();
router.use(authMiddleware);

router.get("/profit-and-loss", requirePermission("finance.read"), validate(periodSchema), FinanceReportController.profitAndLoss);
router.get("/cash-flow", requirePermission("finance.read"), validate(periodSchema), FinanceReportController.cashFlow);
router.get("/profit-trend", requirePermission("finance.read"), validate(trendSchema), FinanceReportController.profitTrend);
router.get("/payables-receivables", requirePermission("finance.read"), FinanceReportController.payablesReceivables);

export default router;
