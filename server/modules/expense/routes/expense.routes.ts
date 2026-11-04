import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { uploadDocument } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { ExpenseController, RecurringExpenseController } from "../controllers/expense.controller";
import {
  categoryIdSchema,
  createCategorySchema,
  createExpenseSchema,
  createRecurringSchema,
  expenseIdSchema,
  expenseReceiptSchema,
  expenseReportSchema,
  listCategoriesSchema,
  listExpensesSchema,
  listRecurringSchema,
  recordRecurringSchema,
  recurringIdSchema,
  skipRecurringSchema,
  updateCategorySchema,
  updateExpenseSchema,
  updateRecurringSchema,
} from "../validators/expense.schema";

/** /api/v1/expenses */
export const expenseRouter = Router();
expenseRouter.use(authMiddleware);
expenseRouter.get("/report", requireAny("expense.read", "report.read"), validate(expenseReportSchema), ExpenseController.report);
expenseRouter.get("/", requirePermission("expense.read"), validate(listExpensesSchema), ExpenseController.list);
expenseRouter.get("/:id", requirePermission("expense.read"), validate(expenseIdSchema), ExpenseController.get);
expenseRouter.post("/", requirePermission("expense.manage"), validate(createExpenseSchema), ExpenseController.create);
expenseRouter.patch("/:id", requirePermission("expense.manage"), validate(updateExpenseSchema), ExpenseController.update);
expenseRouter.delete("/:id", requirePermission("expense.manage"), validate(expenseIdSchema), ExpenseController.remove);
expenseRouter.post("/:id/receipt", requirePermission("expense.manage"), uploadDocument("receipt"), validate(expenseReceiptSchema), ExpenseController.uploadReceipt);

/** /api/v1/expense-categories */
export const expenseCategoryRouter = Router();
expenseCategoryRouter.use(authMiddleware);
expenseCategoryRouter.get("/", requireAny("expense.read", "expense.manage"), validate(listCategoriesSchema), ExpenseController.categories);
expenseCategoryRouter.post("/", requirePermission("expense.manage"), validate(createCategorySchema), ExpenseController.createCategory);
expenseCategoryRouter.patch("/:id", requirePermission("expense.manage"), validate(updateCategorySchema), ExpenseController.updateCategory);
expenseCategoryRouter.delete("/:id", requirePermission("expense.manage"), validate(categoryIdSchema), ExpenseController.removeCategory);

/** /api/v1/recurring-expenses */
export const recurringExpenseRouter = Router();
recurringExpenseRouter.use(authMiddleware);
recurringExpenseRouter.get("/", requirePermission("expense.read"), validate(listRecurringSchema), RecurringExpenseController.list);
recurringExpenseRouter.get("/:id", requirePermission("expense.read"), validate(recurringIdSchema), RecurringExpenseController.get);
recurringExpenseRouter.post("/", requirePermission("expense.manage"), validate(createRecurringSchema), RecurringExpenseController.create);
recurringExpenseRouter.patch("/:id", requirePermission("expense.manage"), validate(updateRecurringSchema), RecurringExpenseController.update);
recurringExpenseRouter.delete("/:id", requirePermission("expense.manage"), validate(recurringIdSchema), RecurringExpenseController.remove);
recurringExpenseRouter.post("/:id/record", requirePermission("expense.manage"), validate(recordRecurringSchema), RecurringExpenseController.record);
recurringExpenseRouter.post("/:id/skip", requirePermission("expense.manage"), validate(skipRecurringSchema), RecurringExpenseController.skip);
