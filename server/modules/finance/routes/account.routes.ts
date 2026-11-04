import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { AccountController, TransferController } from "../controllers/account.controller";
import {
  accountIdSchema,
  accountStatementSchema,
  createAccountSchema,
  createTransferSchema,
  listAccountsSchema,
  listTransfersSchema,
  transferIdSchema,
  updateAccountSchema,
} from "../validators/finance.schema";

/** /api/v1/accounts */
export const accountRouter = Router();
accountRouter.use(authMiddleware);
accountRouter.get(
  "/options",
  requireAny("account.read", "sale.create", "customerpayment.create", "supplierpayment.manage", "expense.manage", "payroll.pay", "loan.manage", "sale.return"),
  AccountController.options
);
accountRouter.get("/", requirePermission("account.read"), validate(listAccountsSchema), AccountController.list);
accountRouter.get("/:id", requirePermission("account.read"), validate(accountIdSchema), AccountController.get);
accountRouter.get("/:id/statement", requirePermission("account.read"), validate(accountStatementSchema), AccountController.statement);
accountRouter.post("/", requirePermission("account.manage"), validate(createAccountSchema), AccountController.create);
accountRouter.patch("/:id", requirePermission("account.manage"), validate(updateAccountSchema), AccountController.update);
accountRouter.delete("/:id", requirePermission("account.manage"), validate(accountIdSchema), AccountController.remove);

/** /api/v1/account-transfers */
export const transferRouter = Router();
transferRouter.use(authMiddleware);
transferRouter.get("/", requirePermission("account.read"), validate(listTransfersSchema), TransferController.list);
transferRouter.post("/", requirePermission("account.manage"), validate(createTransferSchema), TransferController.create);
transferRouter.delete("/:id", requirePermission("account.manage"), validate(transferIdSchema), TransferController.remove);
