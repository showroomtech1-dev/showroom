import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { CustomerController, CustomerPaymentController } from "../controllers/customer.controller";
import {
  createCustomerPaymentSchema,
  createCustomerSchema,
  customerHistorySchema,
  customerIdSchema,
  customerPaymentIdSchema,
  customerStatementSchema,
  debtorsSchema,
  listCustomerPaymentsSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from "../validators/customer.schema";

/** /api/v1/customers */
export const customerRouter = Router();
customerRouter.use(authMiddleware);
customerRouter.get("/debtors", requireAny("customer.read", "finance.read"), validate(debtorsSchema), CustomerController.debtors);
customerRouter.get("/receivables", requireAny("finance.read", "dashboard.read", "customer.read"), CustomerController.receivables);
customerRouter.get("/", requirePermission("customer.read"), validate(listCustomersSchema), CustomerController.list);
customerRouter.get("/:id", requirePermission("customer.read"), validate(customerIdSchema), CustomerController.get);
customerRouter.get("/:id/purchases", requirePermission("customer.read"), validate(customerHistorySchema), CustomerController.history);
customerRouter.get("/:id/statement", requirePermission("customer.read"), validate(customerStatementSchema), CustomerController.statement);
customerRouter.get("/:id/reminder", requireAny("customer.read", "customerpayment.create"), validate(customerIdSchema), CustomerController.reminder);
customerRouter.post("/:id/reminder/email", requireAny("customer.read", "customerpayment.create"), validate(customerIdSchema), CustomerController.emailReminder);
customerRouter.post("/", requirePermission("customer.manage"), validate(createCustomerSchema), CustomerController.create);
customerRouter.patch("/:id", requirePermission("customer.manage"), validate(updateCustomerSchema), CustomerController.update);
customerRouter.delete("/:id", requirePermission("customer.manage"), validate(customerIdSchema), CustomerController.remove);

/** /api/v1/customer-payments */
export const customerPaymentRouter = Router();
customerPaymentRouter.use(authMiddleware);
customerPaymentRouter.get("/", requireAny("customer.read", "customerpayment.create"), validate(listCustomerPaymentsSchema), CustomerPaymentController.list);
customerPaymentRouter.get("/:id", requireAny("customer.read", "customerpayment.create"), validate(customerPaymentIdSchema), CustomerPaymentController.get);
customerPaymentRouter.post("/", requirePermission("customerpayment.create"), validate(createCustomerPaymentSchema), CustomerPaymentController.create);
customerPaymentRouter.delete("/:id", requirePermission("customerpayment.delete"), validate(customerPaymentIdSchema), CustomerPaymentController.remove);
