import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { EmployeeEndpoints } from "@/endpoints/employee.endpoints"
import { ApiError } from "@/transport/http"

export const EMPLOYEES_KEY = "employees"
export const ATTENDANCE_KEY = "attendance"
export const LEAVE_KEY = "leave"
export const LOANS_KEY = "loans"

export function useEmployees(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: [EMPLOYEES_KEY, params],
    queryFn: async () => {
      const res = await EmployeeEndpoints.list(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    enabled,
  })
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: [EMPLOYEES_KEY, id],
    queryFn: async () => {
      const res = await EmployeeEndpoints.get(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useMyEmployeeProfile(enabled = true) {
  return useQuery({
    queryKey: [EMPLOYEES_KEY, "me"],
    queryFn: async () => {
      const res = await EmployeeEndpoints.me()
      return res.success ? res.data : null
    },
    enabled,
  })
}

export function useSaveEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id ? await EmployeeEndpoints.update(id, payload) : await EmployeeEndpoints.create(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [EMPLOYEES_KEY] }),
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await EmployeeEndpoints.remove(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [EMPLOYEES_KEY] }),
  })
}

export function useUploadEmployeePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const res = await EmployeeEndpoints.uploadPhoto(id, file)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [EMPLOYEES_KEY, vars.id] })
      qc.invalidateQueries({ queryKey: [EMPLOYEES_KEY] })
    },
  })
}

export function useAddEmployeeDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file, name, category }: { id: string; file: File; name?: string; category?: string }) => {
      const res = await EmployeeEndpoints.addDocument(id, file, { name, category })
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: [EMPLOYEES_KEY, vars.id] }),
  })
}

export function useRemoveEmployeeDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, documentId }: { id: string; documentId: string }) => {
      const res = await EmployeeEndpoints.removeDocument(id, documentId)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: [EMPLOYEES_KEY, vars.id] }),
  })
}

export function useTodayAttendance(enabled = true) {
  return useQuery({
    queryKey: [ATTENDANCE_KEY, "today"],
    queryFn: async () => {
      const res = await EmployeeEndpoints.todayAttendance()
      return res.success ? res.data : null
    },
    enabled,
  })
}

export function useClockInOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ action, notes }: { action: "in" | "out"; notes?: string }) => {
      const res = action === "in" ? await EmployeeEndpoints.clockIn(notes) : await EmployeeEndpoints.clockOut()
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ATTENDANCE_KEY] }),
  })
}

export function useAttendance(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: [ATTENDANCE_KEY, params],
    queryFn: async () => {
      const res = await EmployeeEndpoints.listAttendance(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    enabled,
  })
}

export function useAttendanceSummary(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: [ATTENDANCE_KEY, "summary", params],
    queryFn: async () => {
      const res = await EmployeeEndpoints.attendanceSummary(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
    enabled,
  })
}

export function useMarkAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { date: string; entries: Array<Record<string, unknown>> }) => {
      const res = await EmployeeEndpoints.markAttendance(payload)
      if (!res.success) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ATTENDANCE_KEY] }),
  })
}

export function useLeaveRequests(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [LEAVE_KEY, params],
    queryFn: async () => {
      const res = await EmployeeEndpoints.listLeave(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useCreateLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await EmployeeEndpoints.createLeave(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LEAVE_KEY] }),
  })
}

export function useReviewLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: "approved" | "rejected"; note?: string }) => {
      const res = await EmployeeEndpoints.reviewLeave(id, decision, note)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LEAVE_KEY] }),
  })
}

export function useLoans(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [LOANS_KEY, params],
    queryFn: async () => {
      const res = await EmployeeEndpoints.listLoans(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
  })
}

export function useCreateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await EmployeeEndpoints.createLoan(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LOANS_KEY] }),
  })
}

export function useRepayLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await EmployeeEndpoints.repayLoan(id, payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LOANS_KEY] }),
  })
}
