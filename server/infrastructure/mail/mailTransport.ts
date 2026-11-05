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
  // Payload read by the Apps Script relay (see server/README.md → Email for the script).
  const response = await fetch(env.email.scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: Array.isArray(mail.to) ? mail.to.join(",") : mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      name: mail.fromName,
      replyTo: mail.replyTo ?? undefined,
      attachments: (mail.attachments ?? []).map((a) => ({ fileName: a.filename, mimeType: a.contentType, content: a.content.toString("base64") })),
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Email relay answered ${response.status}`);
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
      await viaScript(mail);
      return;
    }
    await smtp().sendMail({
      from: `${quoteName(mail.fromName)} <${env.email.fromAddress}>`,
      to: mail.to,
      replyTo: mail.replyTo ?? undefined,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
    });
  },
};
