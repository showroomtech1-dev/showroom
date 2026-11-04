// Sales receipt / invoice layout. "thermal" = 80 mm roll printer width; "a4" = full page invoice.
import { formatMoney } from "../money";
import { createPdf } from "./pdfDocument";

export interface ReceiptData {
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  taxNumber: string | null;
  header: string | null;
  footer: string | null;
  currencySymbol: string;
  currencyCode: string;
  timezone: string;
  /** "RECEIPT", "QUOTATION", "PROFORMA INVOICE"… */
  docTitle: string;
  code: string;
  date: Date | string;
  branchName: string;
  servedBy: string | null;
  customerName: string | null;
  customerPhone: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; discount: number; lineTotal: number }>;
  subtotal: number;
  discountTotal: number;
  taxName: string;
  taxRateBps: number;
  taxAmount: number;
  taxInclusive: boolean;
  total: number;
  payments: Array<{ method: string; amount: number }>;
  amountPaid: number | null;
  balanceDue: number | null;
  returnedAmount: number;
  notes: string | null;
  extraLines?: string[];
}

export async function renderReceipt(data: ReceiptData, size: "thermal" | "a4"): Promise<Buffer> {
  const thermal = size === "thermal";
  const width = thermal ? 226 : 595;
  const estimated = 300 + data.items.length * 26 + data.payments.length * 12 + (data.header ? 30 : 0) + (data.footer ? 40 : 0);
  const handle = createPdf({ title: `${data.docTitle} ${data.code}`, size: thermal ? [width, Math.max(estimated, 360)] : "A4", margin: thermal ? 12 : 40 });
  const { doc } = handle;
  const sym = handle.unicode ? data.currencySymbol : `${data.currencyCode} `;
  const m = (v: number) => formatMoney(v, sym);
  const left = doc.page.margins.left;
  const usable = doc.page.width - left - doc.page.margins.right;
  const base = thermal ? 7.5 : 9.5;

  const center = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
    doc
      .font(opts.bold ? handle.bold : handle.regular)
      .fontSize(opts.size ?? base)
      .fillColor(opts.color ?? "#0f172a")
      .text(text, left, doc.y, { width: usable, align: thermal ? "center" : "left" });
  const pair = (label: string, value: string, bold = false) => {
    const y = doc.y;
    doc.font(bold ? handle.bold : handle.regular).fontSize(bold ? base + 1 : base).fillColor("#0f172a");
    doc.text(label, left, y, { width: usable * 0.55 });
    doc.text(value, left + usable * 0.45, y, { width: usable * 0.55, align: "right" });
    doc.moveDown(0.15);
  };
  const rule = () => {
    doc.moveDown(0.3);
    doc.moveTo(left, doc.y).lineTo(left + usable, doc.y).dash(2, { space: 2 }).lineWidth(0.5).strokeColor("#94a3b8").stroke().undash();
    doc.moveDown(0.4);
  };

  center(data.businessName, { bold: true, size: thermal ? 11 : 16 });
  if (data.businessAddress) center(data.businessAddress, { color: "#475569" });
  if (data.businessPhone) center(`Tel: ${data.businessPhone}`, { color: "#475569" });
  if (data.taxNumber) center(`${data.taxName} No: ${data.taxNumber}`, { color: "#475569" });
  if (data.header) {
    doc.moveDown(0.3);
    center(data.header, { color: "#334155" });
  }
  rule();
  center(data.docTitle, { bold: true, size: base + 2 });
  doc.moveDown(0.2);
  const when = typeof data.date === "string" ? data.date : data.date.toLocaleString("en-GB", { timeZone: data.timezone, dateStyle: "medium", timeStyle: "short" });
  pair("No.", data.code);
  pair("Date", when);
  pair("Branch", data.branchName);
  if (data.servedBy) pair("Served by", data.servedBy);
  if (data.customerName) pair("Customer", data.customerName);
  if (data.customerPhone) pair("Phone", data.customerPhone);
  rule();

  for (const item of data.items) {
    doc.font(handle.bold).fontSize(base).fillColor("#0f172a").text(item.name, left, doc.y, { width: usable });
    pair(`  ${item.quantity} × ${m(item.unitPrice)}${item.discount > 0 ? ` (−${m(item.discount)})` : ""}`, m(item.lineTotal));
  }
  rule();
  pair("Subtotal", m(data.subtotal));
  if (data.discountTotal > 0) pair("Discount", `−${m(data.discountTotal)}`);
  if (data.taxAmount > 0 || data.taxRateBps > 0) {
    pair(`${data.taxName} ${(data.taxRateBps / 100).toFixed(2)}%${data.taxInclusive ? " (incl.)" : ""}`, m(data.taxAmount));
  }
  pair("TOTAL", m(data.total), true);
  if (data.payments.length > 0) {
    doc.moveDown(0.2);
    for (const p of data.payments) pair(`Paid (${p.method.toUpperCase()})`, m(p.amount));
  }
  if (data.returnedAmount > 0) pair("Returned", `−${m(data.returnedAmount)}`);
  if (data.balanceDue !== null && data.balanceDue > 0) pair("BALANCE DUE", m(data.balanceDue), true);
  for (const line of data.extraLines ?? []) center(line, { color: "#334155" });
  if (data.notes) {
    doc.moveDown(0.3);
    center(data.notes, { color: "#475569" });
  }
  rule();
  center(data.footer || "Thank you for your patronage!", { color: "#334155" });
  doc.moveDown(0.3);
  center("Powered by ShowroomPro", { size: base - 1.5, color: "#94a3b8" });
  return handle.done();
}
