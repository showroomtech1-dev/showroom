// Staff emails: payslip (PDF attached) and leave decision.
import { emailLayout, esc, figuresTable, footnote, heading, infoBox, paragraph, warningBox, type LayoutBrand } from "../mailer";
import { formatMoney } from "../money";
import type { ComposedMail } from "./account.mail";

export function payslipEmail(p: {
  brand: LayoutBrand;
  currencySymbol: string;
  name: string;
  code: string;
  period: string;
  payDate: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}): ComposedMail {
  const m = (v: number) => formatMoney(v, p.currencySymbol);
  const body = [
    heading("Your payslip is ready"),
    paragraph(`Hi ${esc(p.name)}, your salary for <strong>${esc(p.period)}</strong> has been paid. Your payslip ${esc(p.code)} is attached.`),
    figuresTable([["Gross pay", m(p.grossPay)], ["Deductions", m(p.totalDeductions)], ["Net pay", m(p.netPay)]], true),
    footnote(`Pay date ${esc(p.payDate)}. Questions about your pay? Speak to your manager.`),
  ].join("");
  return {
    subject: `Payslip for ${p.period} — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Hi ${p.name}, your salary for ${p.period} has been paid. Net pay ${m(p.netPay)}. Your payslip ${p.code} is attached.`,
  };
}

export function leaveDecisionEmail(p: {
  brand: LayoutBrand;
  name: string;
  decision: "approved" | "rejected";
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  note: string | null;
}): ComposedMail {
  const approved = p.decision === "approved";
  const dates = p.startDate === p.endDate ? p.startDate : `${p.startDate} to ${p.endDate}`;
  const body = [
    heading(approved ? "Your leave is approved" : "Your leave request was not approved"),
    paragraph(`Hi ${esc(p.name)}, your ${esc(p.type)} leave request for ${esc(dates)} (${p.days} day${p.days === 1 ? "" : "s"}) has been <strong>${approved ? "approved" : "declined"}</strong>.`),
    p.note ? (approved ? infoBox("Note from your manager", esc(p.note)) : warningBox(`<strong>Reason:</strong> ${esc(p.note)}`)) : "",
    approved ? "" : paragraph("Speak to your manager if you'd like to discuss other dates."),
  ].join("");
  return {
    subject: `Leave ${approved ? "approved" : "not approved"} — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Your ${p.type} leave for ${dates} has been ${approved ? "approved" : "declined"}.${p.note ? ` Note: ${p.note}` : ""}`,
  };
}
