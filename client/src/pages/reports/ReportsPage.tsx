import { useState } from "react"
import { Download, FileSpreadsheet, FileText } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useReportData } from "@/hooks/useFinance"
import { useSuppliers } from "@/hooks/useSuppliers"
import { FinanceEndpoints } from "@/endpoints/finance.endpoints"
import { formatMoney } from "@/lib/money"
import { humanizeLabel, startOfMonthIso, todayIso } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"

const REPORT_TYPES = [
  { value: "daily-summary", label: "Daily Business Summary" },
  { value: "sales", label: "Sales Register Report" },
  { value: "sales-by-item", label: "Sales by Product / Variant" },
  { value: "sales-by-seller", label: "Sales & Commissions by Seller" },
  { value: "inventory", label: "Current Inventory & Valuation" },
  { value: "low-stock", label: "Low & Out-of-Stock Report" },
  { value: "stock-movements", label: "Stock Movements Ledger" },
  { value: "supplier-statement", label: "Supplier Account Statement" },
  { value: "debtors", label: "Customer Debtors & Ageing" },
  { value: "expenses", label: "Operating Expenses Report" },
  { value: "payroll", label: "Payroll Summary Report" },
]

export default function ReportsPage() {
  const { activeBranchId } = useAuth()
  const [reportType, setReportType] = useState("sales")
  const [from, setFrom] = useState(startOfMonthIso())
  const [to, setTo] = useState(todayIso())
  const [supplierId, setSupplierId] = useState("")

  const suppliersQuery = useSuppliers({ limit: 100 }, reportType === "supplier-statement")

  const queryParams: Record<string, unknown> = {
    from,
    to,
    date: to,
    branchId: activeBranchId || undefined,
    supplierId: reportType === "supplier-statement" ? supplierId || undefined : undefined,
  }

  const reportQuery = useReportData(reportType, queryParams)

  const handleExport = (format: "pdf" | "xlsx" | "csv") => {
    FinanceEndpoints.exportReport(reportType, format, queryParams)
  }

  const rawData = reportQuery.data as Record<string, unknown> | unknown[] | undefined
  const tableRows: Array<Record<string, unknown>> = Array.isArray(rawData)
    ? (rawData as Array<Record<string, unknown>>)
    : rawData && typeof rawData === "object"
      ? ((rawData.rows ??
          rawData.items ??
          rawData.sellers ??
          rawData.entries ??
          rawData.topItems ??
          []) as Array<Record<string, unknown>>)
      : []

  const columns = tableRows.length > 0 ? Object.keys(tableRows[0]).slice(0, 7) : []

  const formatCell = (key: string, val: unknown): string => {
    if (val === null || val === undefined) return "—"
    if (typeof val === "number") {
      if (
        /total|amount|price|cost|revenue|balance|paid|outstanding|value|gross|net|commission|debit|credit|supplied/i.test(
          key
        ) &&
        !/count|qty|quantity|days/i.test(key)
      ) {
        return formatMoney(val)
      }
      return val.toLocaleString()
    }
    if (typeof val === "object") return JSON.stringify(val)
    return String(val)
  }

  return (
    <div className="space-y-4" data-cy="reports-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Business Reports & Exports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate, preview, and download formatted PDF, Excel (.xlsx), and CSV reports
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={reportType === "supplier-statement" && !supplierId}
            data-cy="export-pdf-btn"
          >
            <FileText className="h-4 w-4 text-rose-600" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            disabled={reportType === "supplier-statement" && !supplierId}
            data-cy="export-xlsx-btn"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Download Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={reportType === "supplier-statement" && !supplierId}
            data-cy="export-csv-btn"
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Select
            label="Report Type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            options={REPORT_TYPES}
          />
        </div>
        {reportType === "supplier-statement" && (
          <div className="lg:col-span-3">
            <Select
              label="Select Supplier *"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              options={(suppliersQuery.data?.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Choose supplier..."
            />
          </div>
        )}
        <div className="flex items-end lg:col-span-5">
          <DateRangeFilter
            from={from}
            to={to}
            onChange={({ from: f, to: t }) => {
              setFrom(f)
              setTo(t)
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {reportQuery.isLoading ? (
          <p className="py-12 text-center text-xs text-slate-400">Generating report preview...</p>
        ) : tableRows.length === 0 ? (
          <p className="py-12 text-center text-xs text-slate-400">
            {reportType === "supplier-statement" && !supplierId
              ? "Select a supplier above to preview statement"
              : "No rows found for the selected period"}
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="px-4 py-3">
                    {humanizeLabel(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {tableRows.slice(0, 50).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2.5">
                      {formatCell(col, row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
