import { uploadWithFields, wrapCall } from "@/transport/http"
import type {
  Expense,
  ExpenseCategory,
  ExpenseReport,
  RecurringExpense,
} from "@/types/expense.types"

export const ExpenseEndpoints = {
  list: (params?: Record<string, unknown>) =>
    wrapCall<Expense[]>("GET", "/api/v1/expenses", params),

  get: (id: string) =>
    wrapCall<Expense>("GET", `/api/v1/expenses/${id}`),

  report: (params?: Record<string, unknown>) =>
    wrapCall<ExpenseReport>("GET", "/api/v1/expenses/report", { ...params, format: "json" }),

  create: (payload: Record<string, unknown>) =>
    wrapCall<Expense>("POST", "/api/v1/expenses", payload),

  update: (id: string, payload: Record<string, unknown>) =>
    wrapCall<Expense>("PATCH", `/api/v1/expenses/${id}`, payload),

  remove: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/expenses/${id}`),

  uploadReceipt: (id: string, file: File) =>
    uploadWithFields<Expense>(`/api/v1/expenses/${id}/receipt`, file, {}, "receipt"),

  listCategories: (includeInactive = false) =>
    wrapCall<ExpenseCategory[]>("GET", "/api/v1/expense-categories", { includeInactive }),

  createCategory: (name: string) =>
    wrapCall<ExpenseCategory>("POST", "/api/v1/expense-categories", { name }),

  updateCategory: (id: string, payload: { name?: string; isActive?: boolean }) =>
    wrapCall<ExpenseCategory>("PATCH", `/api/v1/expense-categories/${id}`, payload as Record<string, unknown>),

  removeCategory: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/expense-categories/${id}`),

  listRecurring: (params?: Record<string, unknown>) =>
    wrapCall<RecurringExpense[]>("GET", "/api/v1/recurring-expenses", params),

  createRecurring: (payload: Record<string, unknown>) =>
    wrapCall<RecurringExpense>("POST", "/api/v1/recurring-expenses", payload),

  updateRecurring: (id: string, payload: Record<string, unknown>) =>
    wrapCall<RecurringExpense>("PATCH", `/api/v1/recurring-expenses/${id}`, payload),

  removeRecurring: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/recurring-expenses/${id}`),

  recordRecurring: (id: string, payload: Record<string, unknown>) =>
    wrapCall<Expense>("POST", `/api/v1/recurring-expenses/${id}/record`, payload),

  skipRecurring: (id: string) =>
    wrapCall<RecurringExpense>("POST", `/api/v1/recurring-expenses/${id}/skip`),
}
