import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { requireFile } from "../../../shared/middleware/upload.middleware";
import { ExpenseService } from "../services/expense.service";
import { RecurringExpenseService } from "../services/recurringExpense.service";
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

export class ExpenseController {
  static list = handle("Expenses fetched", async (req) => {
    const result = await ExpenseService.Instance.list(actorOf(req), input(req, listExpensesSchema).query);
    return new Paged(result.data, { ...result.meta, summary: { totalAmount: result.total } });
  });

  static report = handle("Expense report fetched", (req) => ExpenseService.Instance.report(actorOf(req), input(req, expenseReportSchema).query));

  static get = handle("Expense fetched", (req) => ExpenseService.Instance.get(actorOf(req), input(req, expenseIdSchema).params.id));

  static create = handle("Expense recorded", (req) => ExpenseService.Instance.create(actorOf(req), input(req, createExpenseSchema).body), 201);

  static update = handle("Expense updated", (req) => {
    const { params, body } = input(req, updateExpenseSchema);
    return ExpenseService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Expense deleted", (req) => ExpenseService.Instance.remove(actorOf(req), input(req, expenseIdSchema).params.id));

  static uploadReceipt = handle("Receipt attached", (req) =>
    ExpenseService.Instance.uploadReceipt(actorOf(req), input(req, expenseReceiptSchema).params.id, requireFile(req))
  );

  static categories = handle("Expense categories fetched", (req) =>
    ExpenseService.Instance.categories(actorOf(req), input(req, listCategoriesSchema).query.includeInactive ?? false)
  );

  static createCategory = handle("Expense category created", (req) =>
    ExpenseService.Instance.createCategory(actorOf(req), input(req, createCategorySchema).body.name), 201
  );

  static updateCategory = handle("Expense category updated", (req) => {
    const { params, body } = input(req, updateCategorySchema);
    return ExpenseService.Instance.updateCategory(actorOf(req), params.id, body);
  });

  static removeCategory = handle("Expense category deleted", (req) =>
    ExpenseService.Instance.removeCategory(actorOf(req), input(req, categoryIdSchema).params.id)
  );
}

export class RecurringExpenseController {
  static list = handle("Recurring expenses fetched", (req) => RecurringExpenseService.Instance.list(actorOf(req), input(req, listRecurringSchema).query));

  static get = handle("Recurring expense fetched", (req) => RecurringExpenseService.Instance.get(actorOf(req), input(req, recurringIdSchema).params.id));

  static create = handle("Recurring expense created", (req) => RecurringExpenseService.Instance.create(actorOf(req), input(req, createRecurringSchema).body), 201);

  static update = handle("Recurring expense updated", (req) => {
    const { params, body } = input(req, updateRecurringSchema);
    return RecurringExpenseService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Recurring expense deleted", (req) => RecurringExpenseService.Instance.remove(actorOf(req), input(req, recurringIdSchema).params.id));

  static record = handle(
    "Recurring expense recorded",
    (req) => {
      const { params, body } = input(req, recordRecurringSchema);
      return RecurringExpenseService.Instance.record(actorOf(req), params.id, body);
    },
    201
  );

  static skip = handle("Recurring expense skipped", (req) => RecurringExpenseService.Instance.skip(actorOf(req), input(req, skipRecurringSchema).params.id));
}
