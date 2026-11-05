// The only place an email actually leaves the server. EMAIL_PROVIDER picks the route:
//   nodemailer (default) — Gmail SMTP with EMAIL_USER + an app password in EMAIL_PASSWORD
//   script               — POST to a Google Apps Script web app (EMAIL_SCRIPT_URL) that calls MailApp
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";

export interface MailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface OutgoingMail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Display name shown as the sender (the business name). */
  fromName: string;
  replyTo?: string | null;
  attachments?: MailAttachment[];
}

let transporter: Transporter | null = null;

function smtp(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.email.user, pass: env.email.password },
      pool: true,
      maxConnections: 2,
    });
  }
  return transporter;
}

const quoteName = (name: string) => `"${name.replace(/["\\\r\n]/g, "")}"`;

async function viaScript(mail: OutgoingMail): Promise<void> {
  // Payload read by the Apps Script relay (includes both html/htmlBody and text/body aliases).
  const toStr = Array.isArray(mail.to) ? mail.to.join(",") : mail.to;
  const response = await fetch(env.email.scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: toStr,
       recipient: toStr,
      subject: mail.subject,
      html: mail.html,
      htmlBody: mail.html,
      text: mail.text,
      body: mail.text,
      name: mail.fromName,
      fromName: mail.fromName,
      replyTo: mail.replyTo ?? undefined,
      attachments: (mail.attachments ?? []).map((a) => ({
        fileName: a.filename,
        filename: a.filename,
        mimeType: a.contentType,
        contentType: a.contentType,
        content: a.content.toString("base64"),
      })),
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  const bodyText = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Email relay answered ${response.status}: ${bodyText.slice(0, 200)}`);
  }
  // Google Apps Script returns 200 text/html when the script throws an uncaught exception or isn't deployed as "Anyone"
  if (bodyText.trim().startsWith("<!DOCTYPE html") || bodyText.includes("script.google.com/macros")) {
    throw new Error(`Apps Script returned an HTML page instead of JSON (check script deployment permissions or script logs)`);
  }
  try {
    const parsed = JSON.parse(bodyText) as { ok?: boolean; success?: boolean; error?: string };
    if (parsed.ok === false || parsed.success === false || parsed.error) {
      throw new Error(`Apps Script error: ${parsed.error || bodyText}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Apps Script")) throw err;
  }
  console.info(`[mail] sent "${mail.subject}" to ${toStr} via Apps Script`);
}

async function viaSmtp(mail: OutgoingMail): Promise<void> {
  const toStr = Array.isArray(mail.to) ? mail.to.join(",") : mail.to;
  await smtp().sendMail({
    from: `${quoteName(mail.fromName)} <${env.email.fromAddress}>`,
    to: mail.to,
    replyTo: mail.replyTo ?? undefined,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: mail.attachments,
  });
  console.info(`[mail] sent "${mail.subject}" to ${toStr} via Gmail SMTP`);
}

export const mailTransport = {
  configured(): boolean {
    return env.email.enabled && env.email.configured;
  },

  async send(mail: OutgoingMail): Promise<void> {
    if (!this.configured()) {
      console.info(`[mail] not configured — skipped "${mail.subject}"`);
      return;
    }
    if (env.email.provider === "script") {
      try {
        await viaScript(mail);
        return;
      } catch (scriptErr) {
        console.error(
          `[mail] Apps Script relay failed (${scriptErr instanceof Error ? scriptErr.message : scriptErr})`
        );
        if (env.email.user && env.email.password) {
          console.info(`[mail] falling back to Gmail SMTP for "${mail.subject}"`);
          await viaSmtp(mail);
          return;
        }
        throw scriptErr;
      }
    }
    await viaSmtp(mail);
  },
};
