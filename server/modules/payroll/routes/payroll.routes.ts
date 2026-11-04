import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { PayrollController } from "../controllers/payroll.controller";
import {
  createRunSchema,
  employeeLedgerSchema,
  itemIdSchema,
  listPayslipsSchema,
  listRunsSchema,
  payItemSchema,
  payRunSchema,
  payslipIdSchema,
  runIdSchema,
  updateItemSchema,
} from "../validators/payroll.schema";

/** /api/v1/payroll */
const router = Router();
router.use(authMiddleware);

router.get("/payslips", requirePermission("payroll.read"), validate(listPayslipsSchema), PayrollController.payslips);
router.get("/payslips/:id", requirePermission("payroll.read"), validate(payslipIdSchema), PayrollController.payslip);
router.get("/payslips/:id/pdf", requirePermission("payroll.read"), validate(payslipIdSchema), PayrollController.payslipPdf);
router.get("/employees/:employeeId/ledger", requirePermission("payroll.read"), validate(employeeLedgerSchema), PayrollController.employeeLedger);

router.get("/runs", requirePermission("payroll.read"), validate(listRunsSchema), PayrollController.list);
router.get("/runs/:id", requirePermission("payroll.read"), validate(runIdSchema), PayrollController.get);
router.post("/runs", requirePermission("payroll.manage"), validate(createRunSchema), PayrollController.create);
router.post("/runs/:id/recalculate", requirePermission("payroll.manage"), validate(runIdSchema), PayrollController.recalculate);
router.patch("/runs/:id/items/:itemId", requirePermission("payroll.manage"), validate(updateItemSchema), PayrollController.updateItem);
router.delete("/runs/:id/items/:itemId", requirePermission("payroll.manage"), validate(itemIdSchema), PayrollController.removeItem);
router.post("/runs/:id/approve", requirePermission("payroll.approve"), validate(runIdSchema), PayrollController.approve);
router.post("/runs/:id/cancel", requireAny("payroll.manage", "payroll.approve"), validate(runIdSchema), PayrollController.cancel);
router.post("/runs/:id/pay", requirePermission("payroll.pay"), validate(payRunSchema), PayrollController.pay);
router.post("/runs/:id/items/:itemId/pay", requirePermission("payroll.pay"), validate(payItemSchema), PayrollController.payItem);

export default router;
