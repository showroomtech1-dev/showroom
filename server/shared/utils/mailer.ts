// Email building blocks. emailLayout() is the ONLY place <html>/<body> appear; every email body is
// made of the components below. All user-supplied text must go through esc() / escapeAndLineBreak().
import { mailTransport, type OutgoingMail } from "../../infrastructure/mail/mailTransport";

const C = {
  dark: "#0f172a",
  accent: "#6366f1",
  text: "#374151",
  muted: "#9ca3af",
  border: "#e2e8f0",
  surface: "#f8fafc",
};

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAndLineBreak(value: unknown): string {
  return esc(value).replace(/\r?\n/g, "<br>");
}

export interface LayoutBrand {
  businessName: string;
  /** Shown in the footer as the contact address (the business's own email when set). */
  footerEmail?: string | null;
}

export function emailLayout(body: string, brand: LayoutBrand): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.surface};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid ${C.border};border-radius:12px;overflow:hidden;background:#ffffff">
<tr><td style="background:${C.dark};padding:20px 28px">
<span style="font-size:20px;font-weight:700;color:#ffffff">${esc(brand.businessName)}</span>
<span style="display:block;font-size:11px;color:${C.accent};margin-top:2px;letter-spacing:0.04em">ShowroomPro</span>
</td></tr>
<tr><td style="padding:32px 28px">${body}</td></tr>
<tr><td style="background:${C.surface};padding:16px 28px;font-size:12px;color:${C.muted};text-align:center">
&copy; ${year} ${esc(brand.businessName)}${brand.footerEmail ? ` &middot; ${esc(brand.footerEmail)}` : ""}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export const heading = (text: string) =>
  `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${C.dark};line-height:1.3">${esc(text)}</h1>`;

/** A paragraph. `html` must already be escaped / built from components. */
export const paragraph = (html: string) => `<p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:1.65">${html}</p>`;

export const otpBox = (code: string) =>
  `<div style="background:${C.surface};border:1.5px solid ${C.border};border-radius:10px;padding:24px 16px;text-align:center;margin:0 0 24px">
<span style="font-size:38px;font-weight:800;letter-spacing:12px;color:${C.dark};font-family:'Courier New',Courier,monospace">${esc(code)}</span></div>`;

export const ctaButton = (url: string, label: string) =>
  `<div style="text-align:center;margin:28px 0"><a href="${esc(url)}" style="display:inline-block;background:${C.accent};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 28px;border-radius:8px">${esc(label)}</a></div>`;

export const infoBox = (label: string, html: string) =>
  `<div style="background:${C.surface};border-left:3px solid ${C.accent};border-radius:0 6px 6px 0;padding:14px 16px;margin:0 0 16px">
<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em">${esc(label)}</p>
<p style="margin:0;font-size:14px;color:${C.text};line-height:1.55">${html}</p></div>`;

export const warningBox = (html: string) =>
  `<div style="background:#fef2f2;border-left:3px solid #ef4444;border-radius:0 6px 6px 0;padding:14px 16px;margin:16px 0">
<p style="margin:0;font-size:14px;color:${C.text}">${html}</p></div>`;

export const footnote = (html: string) => `<p style="margin:16px 0 0;font-size:13px;color:${C.muted};line-height:1.6">${html}</p>`;

export const divider = () => `<div style="border-top:1px solid #e5e7eb;margin:24px 0"></div>`;

/** Two-column figures table (label → value), values right-aligned. Cells are escaped. */
export function figuresTable(rows: Array<[string, string]>, boldLast = false): string {
  const cells = rows
    .map(([label, value], i) => {
      const weight = boldLast && i === rows.length - 1 ? "font-weight:700;color:" + C.dark + ";" : "";
      return `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.border};font-size:14px;color:${C.text};${weight}">${esc(label)}</td>
<td style="padding:8px 0;border-bottom:1px solid ${C.border};font-size:14px;color:${C.text};text-align:right;${weight}">${esc(value)}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${cells}</table>`;
}

/** Section title inside an email (digest sections etc.). */
export const subheading = (text: string) => `<h2 style="margin:24px 0 8px;font-size:16px;font-weight:700;color:${C.dark}">${esc(text)}</h2>`;

/** Bullet list; items are escaped. */
export const list = (items: string[]) =>
  `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:${C.text};line-height:1.7">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

/**
 * Sends an email and never throws: failures are logged, because bookkeeping must not break the
 * action it describes. Returns whether it was handed to the mail provider.
 */
export async function sendMail(mail: OutgoingMail): Promise<boolean> {
  // Reserved test domains (RFC 2606/6761) never receive mail — e.g. the demo @showroompro.test logins.
  const recipients = (Array.isArray(mail.to) ? mail.to : [mail.to]).filter((to) => !/\.(test|example|invalid|localhost)$/i.test(to.trim()));
  if (recipients.length === 0) {
    console.info(`[mail] skipped "${mail.subject}" (test address)`);
    return false;
  }
  try {
    await mailTransport.send({ ...mail, to: recipients });
    return mailTransport.configured();
  } catch (err) {
    console.error(`[mail] failed to send "${mail.subject}"`, err instanceof Error ? err.message : err);
    return false;
  }
}

export const emailConfigured = () => mailTransport.configured();
