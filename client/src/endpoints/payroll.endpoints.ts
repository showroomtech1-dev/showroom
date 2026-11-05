import { openPdfInNewTab, wrapCall } from "@/transport/http"
import type { EmployeePayLedger, PayrollRun, Payslip } from "@/types/payroll.types"

export const PayrollEndpoints = {
  listRuns: (params?: Record<string, unknown>) =>
    wrapCall<PayrollRun[]>("GET", "/api/v1/payroll/runs", params),

  getRun: (id: string) =>
    wrapCall<PayrollRun>("GET", `/api/v1/payroll/runs/${id}`),

  createRun: (payload: Record<string, unknown>) =>
    wrapCall<PayrollRun>("POST", "/api/v1/payroll/runs", payload),

  recalculateRun: (id: string) =>
    wrapCall<PayrollRun>("POST", `/api/v1/payroll/runs/${id}/recalculate`),

  updateItem: (runId: string, itemId: string, payload: Record<string, unknown>) =>
    wrapCall<PayrollRun>("PATCH", `/api/v1/payroll/runs/${runId}/items/${itemId}`, payload),

  removeItem: (runId: string, itemId: string) =>
    wrapCall<PayrollRun>("DELETE", `/api/v1/payroll/runs/${runId}/items/${itemId}`),

  approveRun: (id: string) =>
    wrapCall<PayrollRun>("POST", `/api/v1/payroll/runs/${id}/approve`),

  cancelRun: (id: string) =>
    wrapCall<PayrollRun>("POST", `/api/v1/payroll/runs/${id}/cancel`),

  payRun: (id: string, payload: Record<string, unknown>) =>
    wrapCall<PayrollRun>("POST", `/api/v1/payroll/runs/${id}/pay`, payload),

  payItem: (runId: string, itemId: string, payload: Record<string, unknown>) =>
    wrapCall<PayrollRun>("POST", `/api/v1/payroll/runs/${runId}/items/${itemId}/pay`, payload),

  listPayslips: (params?: Record<string, unknown>) =>
    wrapCall<Payslip[]>("GET", "/api/v1/payroll/payslips", params),

  getPayslip: (id: string) =>
    wrapCall<Payslip>("GET", `/api/v1/payroll/payslips/${id}`),

  openPayslipPdf: (id: string) =>
    openPdfInNewTab(`/api/v1/payroll/payslips/${id}/pdf`),

  /** Emails the payslip (PDF attached) to the employee. */
  emailPayslip: (id: string) =>
    wrapCall<{ sentTo: string } | null>("POST", `/api/v1/payroll/payslips/${id}/email`),

  employeeLedger: (employeeId: string) =>
    wrapCall<EmployeePayLedger>("GET", `/api/v1/payroll/employees/${employeeId}/ledger`),
}
