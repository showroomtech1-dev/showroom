import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PayrollEndpoints } from "@/endpoints/payroll.endpoints"
import { ApiError } from "@/transport/http"
import { LOANS_KEY } from "./useEmployees"

export const PAYROLL_KEY = "payroll"
export const PAYSLIPS_KEY = "payslips"

export function usePayrollRuns(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [PAYROLL_KEY, params],
    queryFn: async () => {
      const res = await PayrollEndpoints.listRuns(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function usePayrollRun(id: string) {
  return useQuery({
    queryKey: [PAYROLL_KEY, id],
    queryFn: async () => {
      const res = await PayrollEndpoints.getRun(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useCreatePayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await PayrollEndpoints.createRun(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PAYROLL_KEY] }),
  })
}

export function useRecalculatePayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await PayrollEndpoints.recalculateRun(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: (_, id) => qc.invalidateQueries({ queryKey: [PAYROLL_KEY, id] }),
  })
}

export function useUpdatePayrollItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ runId, itemId, payload }: { runId: string; itemId: string; payload: Record<string, unknown> }) => {
      const res = await PayrollEndpoints.updateItem(runId, itemId, payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY, vars.runId] })
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY] })
    },
  })
}

export function useRemovePayrollItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ runId, itemId }: { runId: string; itemId: string }) => {
      const res = await PayrollEndpoints.removeItem(runId, itemId)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY, vars.runId] })
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY] })
    },
  })
}

export function useApprovePayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await PayrollEndpoints.approveRun(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY, id] })
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY] })
      qc.invalidateQueries({ queryKey: [LOANS_KEY] })
    },
  })
}

export function useCancelPayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await PayrollEndpoints.cancelRun(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY, id] })
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY] })
    },
  })
}

export function usePayPayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await PayrollEndpoints.payRun(id, payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY, vars.id] })
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY] })
      qc.invalidateQueries({ queryKey: [PAYSLIPS_KEY] })
    },
  })
}

export function usePayPayrollItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ runId, itemId, payload }: { runId: string; itemId: string; payload: Record<string, unknown> }) => {
      const res = await PayrollEndpoints.payItem(runId, itemId, payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY, vars.runId] })
      qc.invalidateQueries({ queryKey: [PAYROLL_KEY] })
      qc.invalidateQueries({ queryKey: [PAYSLIPS_KEY] })
    },
  })
}

export function usePayslips(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [PAYSLIPS_KEY, params],
    queryFn: async () => {
      const res = await PayrollEndpoints.listPayslips(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useEmployeePayLedger(employeeId: string) {
  return useQuery({
    queryKey: [PAYROLL_KEY, "ledger", employeeId],
    queryFn: async () => {
      const res = await PayrollEndpoints.employeeLedger(employeeId)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(employeeId),
  })
}

export function useEmailPayslip() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await PayrollEndpoints.emailPayslip(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
  })
}
