// Customer-facing emails: sales receipt (PDF attached) and debt reminder.
import { ctaButton, emailLayout, esc, figuresTable, footnote, heading, infoBox, paragraph, type LayoutBrand } from "../mailer";
import { formatMoney } from "../money";
import type { ComposedMail } from "./account.mail";

export function receiptEmail(p: {
  brand: LayoutBrand;
  currencySymbol: string;
  customerName: string;
  code: string;
  date: string;
  items: Array<{ name: string; quantity: number; lineTotal: number }>;
  total: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: string | null;
  receiptUrl: string;
}): ComposedMail {
  const m = (v: number) => formatMoney(v, p.currencySymbol);
  const rows: Array<[string, string]> = [
    ...p.items.map((i): [string, string] => [`${i.quantity} × ${i.name}`, m(i.lineTotal)]),
    ["Total", m(p.total)],
  ];
  const body = [
    heading("Thank you for your purchase"),
    paragraph(`Hi ${esc(p.customerName)}, here is your receipt <strong>${esc(p.code)}</strong> from ${esc(p.date)}. The PDF is attached.`),
    figuresTable(rows, true),
    infoBox("Payment", `Paid: <strong>${esc(m(p.amountPaid))}</strong>${p.balanceDue > 0 ? `<br>Balance due: <strong>${esc(m(p.balanceDue))}</strong>${p.dueDate ? ` by ${esc(p.dueDate)}` : ""}` : ""}`),
    ctaButton(p.receiptUrl, "View receipt"),
    footnote(`Questions about this purchase? Just reply to this email.`),
  ].join("");
  return {
    subject: `Receipt ${p.code} — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Thank you for shopping with ${p.brand.businessName}. Receipt ${p.code}, total ${m(p.total)}${p.balanceDue > 0 ? `, balance due ${m(p.balanceDue)}` : ""}. View it at ${p.receiptUrl}.`,
  };
}

export function debtReminderEmail(p: {
  brand: LayoutBrand;
  currencySymbol: string;
  customerName: string;
  balance: number;
  overdue: number;
  businessPhone: string | null;
}): ComposedMail {
  const m = (v: number) => formatMoney(v, p.currencySymbol);
  const body = [
    heading("A friendly payment reminder"),
    paragraph(`Hello ${esc(p.customerName)}, this is a reminder from ${esc(p.brand.businessName)} that your outstanding balance is <strong>${esc(m(p.balance))}</strong>.`),
    p.overdue > 0 ? infoBox("Overdue", `${esc(m(p.overdue))} of this is past its due date.`) : "",
    paragraph("Kindly make payment at your earliest convenience. If you've already paid, please ignore this message."),
    footnote(`Thank you for your patronage.${p.businessPhone ? ` Call us on ${esc(p.businessPhone)}.` : ""}`),
  ].join("");
  return {
    subject: `Payment reminder — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Hello ${p.customerName}, your outstanding balance with ${p.brand.businessName} is ${m(p.balance)}${p.overdue > 0 ? ` (${m(p.overdue)} overdue)` : ""}. Kindly make payment at your earliest convenience.`,
  };
}
