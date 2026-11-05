import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExpenseEndpoints } from "@/endpoints/expense.endpoints"
import { ApiError } from "@/transport/http"

export const EXPENSES_KEY = "expenses"
export const EXPENSE_CATEGORIES_KEY = "expense-categories"
export const RECURRING_EXPENSES_KEY = "recurring-expenses"

export function useExpenses(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [EXPENSES_KEY, params],
    queryFn: async () => {
      const res = await ExpenseEndpoints.list(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useExpenseReport(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [EXPENSES_KEY, "report", params],
    queryFn: async () => {
      const res = await ExpenseEndpoints.report(params)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}

export function useSaveExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id
        ? await ExpenseEndpoints.update(id, payload)
        : await ExpenseEndpoints.create(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [EXPENSES_KEY] }),
  })
}

export function useUploadExpenseReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const res = await ExpenseEndpoints.uploadReceipt(id, file)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [EXPENSES_KEY] }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await ExpenseEndpoints.remove(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [EXPENSES_KEY] }),
  })
}

export function useExpenseCategories(includeInactive = false) {
  return useQuery({
    queryKey: [EXPENSE_CATEGORIES_KEY, includeInactive],
    queryFn: async () => {
      const res = await ExpenseEndpoints.listCategories(includeInactive)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
  })
}

export function useSaveExpenseCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, isActive }: { id?: string; name?: string; isActive?: boolean }) => {
      const res = id
        ? await ExpenseEndpoints.updateCategory(id, { name, isActive })
        : await ExpenseEndpoints.createCategory(name || "")
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXPENSE_CATEGORIES_KEY] })
      qc.invalidateQueries({ queryKey: [EXPENSES_KEY] })
    },
  })
}

export function useDeleteExpenseCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await ExpenseEndpoints.removeCategory(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXPENSE_CATEGORIES_KEY] })
      qc.invalidateQueries({ queryKey: [EXPENSES_KEY] })
    },
  })
}

export function useRecurringExpenses(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [RECURRING_EXPENSES_KEY, params],
    queryFn: async () => {
      const res = await ExpenseEndpoints.listRecurring(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
  })
}

export function useSaveRecurringExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id
        ? await ExpenseEndpoints.updateRecurring(id, payload)
        : await ExpenseEndpoints.createRecurring(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RECURRING_EXPENSES_KEY] }),
  })
}

export function useRecordRecurringExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await ExpenseEndpoints.recordRecurring(id, payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RECURRING_EXPENSES_KEY] })
      qc.invalidateQueries({ queryKey: [EXPENSES_KEY] })
    },
  })
}

export function useSkipRecurringExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await ExpenseEndpoints.skipRecurring(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RECURRING_EXPENSES_KEY] }),
  })
}

export function useDeleteRecurringExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await ExpenseEndpoints.removeRecurring(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RECURRING_EXPENSES_KEY] }),
  })
}
