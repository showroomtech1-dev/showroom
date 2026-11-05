// Emails for the people running the business: the daily digest and urgent alerts.
import { ctaButton, emailLayout, esc, figuresTable, footnote, heading, list, paragraph, subheading, type LayoutBrand } from "../mailer";
import { formatMoney } from "../money";
import type { ComposedMail } from "./account.mail";

export interface DigestData {
  date: string;
  yesterday: { date: string; salesCount: number; totalSales: number };
  monthToDate: { salesCount: number; totalSales: number };
  stock: { low: number; out: number; items: string[] };
  supplierPayments: Array<{ label: string; amount: number; overdue: boolean }>;
  customerDebts: Array<{ label: string; amount: number; overdue: boolean }>;
  recurringExpenses: Array<{ label: string; amount: number; overdue: boolean }>;
}

export function dailyDigestEmail(p: { brand: LayoutBrand; currencySymbol: string; name: string; data: DigestData; dashboardUrl: string }): ComposedMail {
  const m = (v: number) => formatMoney(v, p.currencySymbol);
  const d = p.data;
  const due = (rows: DigestData["supplierPayments"]) => list(rows.map((r) => `${r.overdue ? "OVERDUE — " : ""}${r.label}: ${m(r.amount)}`));
  const nothing = paragraph("Nothing due.");
  const body = [
    heading(`Good morning, ${p.name.split(" ")[0]}`),
    paragraph(`Here's ${esc(p.brand.businessName)} at a glance for ${esc(d.date)}.`),
    subheading("Sales"),
    figuresTable([
      [`Yesterday (${d.yesterday.date})`, `${m(d.yesterday.totalSales)} · ${d.yesterday.salesCount} sale${d.yesterday.salesCount === 1 ? "" : "s"}`],
      ["This month so far", `${m(d.monthToDate.totalSales)} · ${d.monthToDate.salesCount} sales`],
    ]),
    subheading(`Stock — ${d.stock.out} out, ${d.stock.low} running low`),
    d.stock.items.length ? list(d.stock.items) : paragraph("All products are above their reorder levels."),
    subheading("Supplier payments due"),
    d.supplierPayments.length ? due(d.supplierPayments) : nothing,
    subheading("Customer debts due"),
    d.customerDebts.length ? due(d.customerDebts) : nothing,
    subheading("Bills due (recurring expenses)"),
    d.recurringExpenses.length ? due(d.recurringExpenses) : nothing,
    ctaButton(p.dashboardUrl, "Open dashboard"),
    footnote("You get this summary every morning. The owner can turn it off in Settings → Notifications."),
  ].join("");
  return {
    subject: `Daily summary for ${d.date} — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `${p.brand.businessName} on ${d.date}: yesterday's sales ${m(d.yesterday.totalSales)} (${d.yesterday.salesCount}); ${d.stock.out} out of stock, ${d.stock.low} low; ${d.supplierPayments.length} supplier payment(s), ${d.customerDebts.length} customer debt(s) and ${d.recurringExpenses.length} bill(s) due.`,
  };
}

export function urgentAlertsEmail(p: { brand: LayoutBrand; name: string; alerts: Array<{ title: string; body: string | null }>; url: string }): ComposedMail {
  const count = p.alerts.length;
  const body = [
    heading(count === 1 ? "Something needs your attention" : `${count} things need your attention`),
    paragraph(`Hi ${esc(p.name)}, these just came up at ${esc(p.brand.businessName)}:`),
    list(p.alerts.map((a) => (a.body ? `${a.title} — ${a.body}` : a.title))),
    ctaButton(p.url, "Open ShowroomPro"),
    footnote("You get these emails for out-of-stock products and overdue supplier payments. The owner can turn them off in Settings → Notifications."),
  ].join("");
  return {
    subject: `${count === 1 ? p.alerts[0].title : `${count} urgent alerts`} — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `${p.brand.businessName}: ${p.alerts.map((a) => a.title).join("; ")}. Open ${p.url} for details.`,
  };
}
