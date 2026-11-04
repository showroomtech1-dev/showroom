import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { LoanController } from "../controllers/loan.controller";
import { createLoanSchema, listLoansSchema, loanIdSchema, repayLoanSchema, updateLoanSchema } from "../validators/loan.schema";

/** /api/v1/loans — staff loans and salary advances. */
const router = Router();
router.use(authMiddleware);

router.get("/", requireAny("loan.manage", "payroll.read"), validate(listLoansSchema), LoanController.list);
router.get("/:id", requireAny("loan.manage", "payroll.read"), validate(loanIdSchema), LoanController.get);
router.post("/", requirePermission("loan.manage"), validate(createLoanSchema), LoanController.create);
router.patch("/:id", requirePermission("loan.manage"), validate(updateLoanSchema), LoanController.update);
router.post("/:id/repayments", requirePermission("loan.manage"), validate(repayLoanSchema), LoanController.repay);
router.delete("/:id", requirePermission("loan.manage"), validate(loanIdSchema), LoanController.remove);

export default router;
