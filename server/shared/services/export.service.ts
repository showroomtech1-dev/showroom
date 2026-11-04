// Renders a tabular dataset to CSV, Excel or PDF. Every report and statement builds an ExportTable
// and hands it here, so all exports share one look and one set of formatting rules.
import ExcelJS from "exceljs";
import type { ExportFormat } from "../../config/constants";
import { FileResult } from "../http/handler";
import { formatMoney } from "../utils/money";
import { addPageNumbers, createPdf } from "../utils/pdf/pdfDocument";

export type ColumnType = "text" | "money" | "number" | "date" | "datetime" | "percent";

export interface ExportColumn {
  key: string;
  label: string;
  type?: ColumnType;
  /** Relative width weight for PDF layout (default 1). */
  width?: number;
}

export interface ExportTable {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, unknown>;
  /** Key figures printed above the table (e.g. opening / closing balance). */
  summary?: Array<{ label: string; value: unknown; type?: ColumnType }>;
}

export interface ExportContext {
  businessName: string;
  businessAddress?: string | null;
  businessPhone?: string | null;
  currencySymbol: string;
  currencyCode: string;
  timezone: string;
  generatedBy?: string;
}

const isMoneyLike = (t?: ColumnType) => t === "money";

function formatCell(value: unknown, type: ColumnType | undefined, symbol: string, timezone: string): string {
  if (value === null || value === undefined || value === "") return "";
  switch (type) {
    case "money":
      return formatMoney(Number(value), symbol);
    case "number":
      return Number(value).toLocaleString("en-NG");
    case "percent":
      return `${(Number(value) / 100).toFixed(2)}%`;
    case "datetime":
      return new Date(String(value)).toLocaleString("en-GB", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" });
    case "date":
      return String(value).slice(0, 10);
    default:
      return String(value);
  }
}

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export class ExportService {
  static Instance = new ExportService();
  private constructor() {}

  async render(format: Exclude<ExportFormat, "json">, table: ExportTable, ctx: ExportContext, filenameBase: string): Promise<FileResult> {
    const safe = filenameBase.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
    if (format === "csv") return new FileResult(`${safe}.csv`, "text/csv; charset=utf-8", this.csv(table));
    if (format === "xlsx") {
      return new FileResult(`${safe}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", await this.xlsx(table, ctx));
    }
    return new FileResult(`${safe}.pdf`, "application/pdf", await this.pdf(table, ctx));
  }

  /** Money columns are exported in major units (₦1,500.00 → 1500.00) so spreadsheets can sum them. */
  private csv(table: ExportTable): Buffer {
    const major = (v: unknown, t?: ColumnType) => (isMoneyLike(t) && v !== null && v !== undefined && v !== "" ? (Number(v) / 100).toFixed(2) : v);
    const lines = [table.columns.map((c) => csvEscape(c.label)).join(",")];
    for (const row of table.rows) {
      lines.push(table.columns.map((c) => csvEscape(String(major(row[c.key], c.type) ?? ""))).join(","));
    }
    if (table.totals) lines.push(table.columns.map((c) => csvEscape(String(major(table.totals?.[c.key], c.type) ?? ""))).join(","));
    // BOM so Excel opens UTF-8 (₦, accented names) correctly.
    return Buffer.from(`﻿${lines.join("\r\n")}`, "utf8");
  }

  private async xlsx(table: ExportTable, ctx: ExportContext): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "ShowroomPro";
    const ws = wb.addWorksheet(table.title.slice(0, 31));
    ws.addRow([ctx.businessName]).font = { bold: true, size: 14 };
    ws.addRow([table.title]).font = { bold: true, size: 12 };
    if (table.subtitle) ws.addRow([table.subtitle]);
    for (const s of table.summary ?? []) {
      ws.addRow([s.label, isMoneyLike(s.type) ? Number(s.value) / 100 : s.value]);
    }
    ws.addRow([]);
    const header = ws.addRow(table.columns.map((c) => c.label));
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    });
    const moneyFmt = `"${ctx.currencySymbol}"#,##0.00`;
    const toCell = (v: unknown, t?: ColumnType) => {
      if (v === null || v === undefined) return null;
      if (isMoneyLike(t)) return Number(v) / 100;
      if (t === "number") return Number(v);
      if (t === "datetime") return new Date(String(v));
      return v as string | number;
    };
    for (const row of table.rows) ws.addRow(table.columns.map((c) => toCell(row[c.key], c.type)));
    if (table.totals) ws.addRow(table.columns.map((c) => toCell(table.totals?.[c.key], c.type))).font = { bold: true };
    table.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.max(12, Math.min(40, c.label.length + 6));
      if (isMoneyLike(c.type)) col.numFmt = moneyFmt;
      if (c.type === "datetime") col.numFmt = "dd mmm yyyy hh:mm";
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private async pdf(table: ExportTable, ctx: ExportContext): Promise<Buffer> {
    const landscape = table.columns.length > 6;
    const handle = createPdf({ title: table.title, layout: landscape ? "landscape" : "portrait" });
    const { doc } = handle;
    const symbol = handle.unicode ? ctx.currencySymbol : `${ctx.currencyCode} `;
    const left = doc.page.margins.left;
    const usable = doc.page.width - left - doc.page.margins.right;

    doc.font(handle.bold).fontSize(14).fillColor("#0f172a").text(ctx.businessName);
    doc.font(handle.regular).fontSize(8).fillColor("#64748b");
    if (ctx.businessAddress) doc.text(ctx.businessAddress);
    if (ctx.businessPhone) doc.text(ctx.businessPhone);
    doc.moveDown(0.6).font(handle.bold).fontSize(12).fillColor("#0f172a").text(table.title);
    if (table.subtitle) doc.font(handle.regular).fontSize(9).fillColor("#475569").text(table.subtitle);
    doc
      .font(handle.regular)
      .fontSize(7)
      .fillColor("#94a3b8")
      .text(`Generated ${new Date().toLocaleString("en-GB", { timeZone: ctx.timezone })}${ctx.generatedBy ? ` by ${ctx.generatedBy}` : ""}`);

    if (table.summary && table.summary.length > 0) {
      doc.moveDown(0.5);
      for (const s of table.summary) {
        doc.font(handle.regular).fontSize(9).fillColor("#334155").text(`${s.label}: `, { continued: true });
        doc.font(handle.bold).text(formatCell(s.value, s.type, symbol, ctx.timezone));
      }
    }
    doc.moveDown(0.6);

    const weights = table.columns.map((c) => c.width ?? 1);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (w / weightSum) * usable);
    const fontSize = landscape ? 7 : 8;
    const rowPad = 3;

    const drawRow = (cells: string[], opts: { bold?: boolean; fill?: string }) => {
      doc.font(opts.bold ? handle.bold : handle.regular).fontSize(fontSize);
      const heights = cells.map((text, i) => doc.heightOfString(text, { width: widths[i] - 4 }));
      const height = Math.max(...heights, fontSize) + rowPad * 2;
      if (doc.y + height > doc.page.height - doc.page.margins.bottom - 10) {
        doc.addPage();
        drawHeader();
        doc.font(opts.bold ? handle.bold : handle.regular).fontSize(fontSize);
      }
      const y = doc.y;
      if (opts.fill) doc.rect(left, y, usable, height).fill(opts.fill);
      let x = left;
      cells.forEach((text, i) => {
        const type = table.columns[i].type;
        const align = type === "money" || type === "number" || type === "percent" ? "right" : "left";
        doc.fillColor("#0f172a").text(text, x + 2, y + rowPad, { width: widths[i] - 4, align });
        x += widths[i];
      });
      doc.moveTo(left, y + height).lineTo(left + usable, y + height).lineWidth(0.4).strokeColor("#e2e8f0").stroke();
      doc.x = left;
      doc.y = y + height;
    };
    const drawHeader = () => drawRow(table.columns.map((c) => c.label), { bold: true, fill: "#f1f5f9" });

    drawHeader();
    if (table.rows.length === 0) {
      doc.moveDown(0.5).font(handle.regular).fontSize(9).fillColor("#64748b").text("No records for this period.", left);
    }
    for (const row of table.rows) {
      drawRow(table.columns.map((c) => formatCell(row[c.key], c.type, symbol, ctx.timezone)), {});
    }
    if (table.totals) {
      drawRow(table.columns.map((c) => formatCell(table.totals?.[c.key], c.type, symbol, ctx.timezone)), { bold: true, fill: "#f8fafc" });
    }

    addPageNumbers(handle, `${ctx.businessName} — ${table.title}`);
    return handle.done();
  }
}
