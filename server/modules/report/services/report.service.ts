// One entry point for every report. Each report builds an ExportTable; format=json returns it as
// data, csv / xlsx / pdf return a file.
import { assertPermission, can } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { ExportService, type ExportColumn, type ExportTable } from "../../../shared/services/export.service";
import type { Actor } from "../../../shared/types/actor";
import { resolveRange, todayIn } from "../../../shared/utils/dates";
import { CustomerRepository } from "../../customer/repositories/customer.repository";
import { FinanceReportService } from "../../finance/services/financeReport.service";
import { OrganizationService } from "../../organization/services/organization.service";
import { SettingsService } from "../../organization/services/settings.service";
import { SaleReportRepository } from "../../sale/repositories/saleReport.repository";
import { SupplierService } from "../../supplier/services/supplier.service";
import { ReportRepository, type ReportFilter } from "../repositories/report.repository";
import type { ReportQuery, ReportType } from "../validators/report.schema";

const sumOf = (rows: Array<Record<string, unknown>>, ...keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, rows.reduce((s, r) => s + Number(r[k] ?? 0), 0)]));

export class ReportService {
  static Instance = new ReportService();
  private constructor(
    private readonly repo = ReportRepository.Instance,
    private readonly saleReports = SaleReportRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly finance = FinanceReportService.Instance,
    private readonly suppliers = SupplierService.Instance,
    private readonly organizations = OrganizationService.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly exporter = ExportService.Instance
  ) {}

  async run(actor: Actor, type: ReportType, query: ReportQuery) {
    assertPermission(actor, "report.read");
    if (query.format !== "json") assertPermission(actor, "report.export");
    if (type === "supplier-statement") {
      if (!query.supplierId) throw AppError.unprocessable("Choose a supplier", [{ field: "supplierId", message: "Required for a supplier statement" }]);
      return this.suppliers.statement(actor, query.supplierId, { from: query.from, to: query.to, format: query.format });
    }
    const { timezone } = await this.settings.get(actor.organizationId);
    const { from, to } = resolveRange(timezone, query.from, query.to);
    const filter: ReportFilter = { ...query, organizationId: actor.organizationId, branchId: readBranchScope(actor, query.branchId), from, to, timezone };
    const table = await this.build(actor, type, filter);
    if (query.format === "json") return table;
    return this.exporter.render(query.format, table, await this.organizations.exportContext(actor), `${type}-${from}-${to}`);
  }

  private async build(actor: Actor, type: Exclude<ReportType, "supplier-statement">, f: ReportFilter): Promise<ExportTable> {
    const period = `${f.from} to ${f.to}`;
    const showCost = can(actor, "product.viewcost");
    const costCols = (cols: ExportColumn[]) => (showCost ? cols : cols.filter((c) => !["cost", "profit", "costPrice", "valueAtCost"].includes(c.key)));

    switch (type) {
      case "sales": {
        const rows = await this.repo.sales(f);
        return {
          title: "Sales report",
          subtitle: period,
          columns: costCols([
            { key: "code", label: "Receipt" },
            { key: "soldAt", label: "Date", type: "datetime", width: 1.4 },
            { key: "customer", label: "Customer", width: 1.4 },
            { key: "soldBy", label: "Sold by" },
            { key: "items", label: "Qty", type: "number", width: 0.6 },
            { key: "discount", label: "Discount", type: "money" },
            { key: "tax", label: "Tax", type: "money" },
            { key: "total", label: "Total", type: "money" },
            { key: "paid", label: "Paid", type: "money" },
            { key: "balance", label: "Balance", type: "money" },
            { key: "cost", label: "Cost", type: "money" },
            { key: "profit", label: "Profit", type: "money" },
          ]),
          rows,
          totals: { code: "Total", ...sumOf(rows, "items", "discount", "tax", "total", "paid", "balance", ...(showCost ? ["cost", "profit"] : [])) },
        };
      }
      case "sales-by-product": {
        const rows = await this.repo.salesByProduct(f);
        return {
          title: "Sales by product",
          subtitle: period,
          columns: costCols([
            { key: "product", label: "Product", width: 2 },
            { key: "variant", label: "Variant" },
            { key: "sku", label: "SKU" },
            { key: "category", label: "Category" },
            { key: "quantity", label: "Qty sold", type: "number" },
            { key: "revenue", label: "Revenue", type: "money" },
            { key: "cost", label: "Cost", type: "money" },
            { key: "profit", label: "Profit", type: "money" },
          ]),
          rows,
          totals: { product: "Total", ...sumOf(rows, "quantity", "revenue", ...(showCost ? ["cost", "profit"] : [])) },
        };
      }
      case "sales-by-staff": {
        const rows = (await this.saleReports.bySeller({ ...f, soldById: f.staffId ?? null })) as unknown as Array<Record<string, unknown>>;
        return {
          title: "Sales by staff member",
          subtitle: period,
          columns: [
            { key: "soldByName", label: "Staff", width: 2 },
            { key: "salesCount", label: "Sales", type: "number" },
            { key: "totalSales", label: "Total sales", type: "money" },
            { key: "netSales", label: "Excl. tax", type: "money" },
            { key: "returned", label: "Returned", type: "money" },
            { key: "commission", label: "Commission", type: "money" },
          ],
          rows,
          totals: { soldByName: "Total", ...sumOf(rows, "salesCount", "totalSales", "netSales", "returned", "commission") },
        };
      }
      case "inventory": {
        const rows = await this.repo.inventory(f);
        return {
          title: "Inventory & valuation",
          subtitle: `As at ${todayIn(f.timezone)}`,
          columns: costCols([
            { key: "product", label: "Product", width: 2 },
            { key: "variant", label: "Variant" },
            { key: "sku", label: "SKU" },
            { key: "category", label: "Category" },
            { key: "quantity", label: "On hand", type: "number" },
            { key: "reorderLevel", label: "Reorder at", type: "number" },
            { key: "costPrice", label: "Cost price", type: "money" },
            { key: "sellingPrice", label: "Selling price", type: "money" },
            { key: "valueAtCost", label: "Value (cost)", type: "money" },
            { key: "valueAtSelling", label: "Value (selling)", type: "money" },
            { key: "status", label: "Status" },
          ]),
          rows,
          totals: { product: "Total", ...sumOf(rows, "quantity", "valueAtSelling", ...(showCost ? ["valueAtCost"] : [])) },
        };
      }
      case "expenses": {
        assertPermission(actor, "expense.read");
        const rows = await this.repo.expenses(f);
        return {
          title: "Expenses",
          subtitle: period,
          columns: [
            { key: "date", label: "Date", type: "date" },
            { key: "code", label: "Ref" },
            { key: "category", label: "Category" },
            { key: "payee", label: "Payee", width: 1.5 },
            { key: "description", label: "Description", width: 2 },
            { key: "method", label: "Method" },
            { key: "amount", label: "Amount", type: "money" },
          ],
          rows,
          totals: { date: "Total", ...sumOf(rows, "amount") },
        };
      }
      case "payroll": {
        assertPermission(actor, "payroll.read");
        const rows = await this.repo.payroll(f);
        return {
          title: "Payroll report",
          subtitle: `Pay dates ${period}`,
          columns: [
            { key: "run", label: "Run" },
            { key: "employee", label: "Employee", width: 1.6 },
            { key: "basic", label: "Basic", type: "money" },
            { key: "allowancesBonus", label: "Allow./bonus", type: "money" },
            { key: "commission", label: "Commission", type: "money" },
            { key: "gross", label: "Gross", type: "money" },
            { key: "deductions", label: "Deductions", type: "money" },
            { key: "net", label: "Net", type: "money" },
            { key: "paid", label: "Paid", type: "money" },
          ],
          rows,
          totals: { run: "Total", ...sumOf(rows, "basic", "allowancesBonus", "commission", "gross", "deductions", "net", "paid") },
        };
      }
      case "profit-and-loss": {
        assertPermission(actor, "finance.read");
        const p = await this.finance.profitAndLoss(actor, { from: f.from, to: f.to, branchId: f.branchId ?? undefined });
        const rows = [
          { line: "Sales (excluding tax)", amount: p.revenue.salesExcludingTax },
          { line: "Less: returns", amount: -p.revenue.returns },
          { line: "Revenue", amount: p.revenue.total, bold: true },
          { line: "Cost of goods sold", amount: -p.costOfGoodsSold },
          { line: "Gross profit", amount: p.grossProfit },
          ...p.expenses.byCategory.map((e) => ({ line: `Expense: ${e.category}`, amount: -e.amount })),
          { line: "Vendor service bills", amount: -p.expenses.vendorBills },
          { line: "Salaries & wages", amount: -p.expenses.payroll },
          { line: "Total operating expenses", amount: -p.expenses.total },
          { line: "NET PROFIT", amount: p.netProfit },
          { line: `${p.tax.name} collected (owed to tax authority)`, amount: p.tax.collected },
        ];
        return { title: "Profit & loss statement", subtitle: period, columns: [{ key: "line", label: "", width: 3 }, { key: "amount", label: "Amount", type: "money" }], rows };
      }
      case "cash-flow": {
        assertPermission(actor, "finance.read");
        const c = await this.finance.cashFlow(actor, { from: f.from, to: f.to, branchId: f.branchId ?? undefined });
        const rows = [
          ...c.inflows.map((l) => ({ line: `In: ${l.label}`, amount: l.amount })),
          ...c.outflows.map((l) => ({ line: `Out: ${l.label}`, amount: -l.amount })),
        ];
        return {
          title: "Cash flow",
          subtitle: period,
          summary: [
            ...(c.openingBalance !== null ? [{ label: "Opening balance", value: c.openingBalance, type: "money" as const }] : []),
            { label: "Net cash flow", value: c.netCashFlow, type: "money" },
            ...(c.closingBalance !== null ? [{ label: "Closing balance", value: c.closingBalance, type: "money" as const }] : []),
          ],
          columns: [{ key: "line", label: "", width: 3 }, { key: "amount", label: "Amount", type: "money" }],
          rows,
          totals: { line: "Net cash flow", amount: c.netCashFlow },
        };
      }
      case "debtors": {
        assertPermission(actor, "customer.read");
        const rows = (await this.customers.debtors(actor.organizationId, todayIn(f.timezone))) as unknown as Array<Record<string, unknown>>;
        return {
          title: "Debtors (owed by customers)",
          subtitle: `As at ${todayIn(f.timezone)}`,
          columns: [
            { key: "name", label: "Customer", width: 2 },
            { key: "phone", label: "Phone" },
            { key: "current", label: "Not due", type: "money" },
            { key: "days1to30", label: "1–30 days", type: "money" },
            { key: "days31to60", label: "31–60", type: "money" },
            { key: "days61to90", label: "61–90", type: "money" },
            { key: "over90", label: "90+", type: "money" },
            { key: "balance", label: "Balance", type: "money" },
          ],
          rows,
          totals: { name: "Total", ...sumOf(rows, "current", "days1to30", "days31to60", "days61to90", "over90", "balance") },
        };
      }
      case "creditors": {
        assertPermission(actor, "supplier.read");
        const rows = (await this.repo.creditors(actor.organizationId, todayIn(f.timezone))).map((r) => ({ ...r, balance: Number(r.supplied) - Number(r.paid) }));
        return {
          title: "Creditors (owed to suppliers & vendors)",
          subtitle: `As at ${todayIn(f.timezone)}`,
          columns: [
            { key: "code", label: "Code" },
            { key: "name", label: "Supplier / vendor", width: 2 },
            { key: "type", label: "Type" },
            { key: "supplied", label: "Supplied", type: "money" },
            { key: "paid", label: "Paid", type: "money" },
            { key: "overdue", label: "Overdue", type: "money" },
            { key: "balance", label: "Balance", type: "money" },
          ],
          rows,
          totals: { name: "Total", ...sumOf(rows, "supplied", "paid", "overdue", "balance") },
        };
      }
      default:
        throw AppError.badRequest("Unknown report");
    }
  }
}
