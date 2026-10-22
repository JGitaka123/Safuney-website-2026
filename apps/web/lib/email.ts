/**
 * Transactional email, through the site's own mail server (SMTP_HOST/SMTP_USER/SMTP_PASSWORD — the
 * cPanel mailbox) or Resend (RESEND_API_KEY). SMTP wins when both are set. Switched off (returns
 * { sent: false }) when neither is, so callers can decide what "not sent" means for them. Never logs
 * recipients or bodies.
 */
import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";
import { config, services } from "./env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export type EmailResult = { sent: true; id: string | null } | { sent: false; reason: "not_configured" | "provider_error" };

let resendClient: Resend | null = null;
let smtpClient: Transporter | null = null;

function resend(): Resend {
  if (!resendClient) resendClient = new Resend(process.env["RESEND_API_KEY"]);
  return resendClient;
}

function smtp(): Transporter {
  if (!smtpClient) {
    const { host, port, user, password } = config.smtp;
    smtpClient = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
      // A serverless function cannot wait out a slow mail server; fail and let the caller say so.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return smtpClient;
}

/** Send a plain-text email from the site's sender address. */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!services.email()) return { sent: false, reason: "not_configured" };
  if (config.smtp.host) {
    try {
      const info = await smtp().sendMail({
        from: config.emailFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      });
      return { sent: true, id: info.messageId ?? null };
    } catch (e) {
      console.error("email.send.failed", { via: "smtp", code: (e as { code?: string }).code ?? "exception" });
      return { sent: false, reason: "provider_error" };
    }
  }
  try {
    const { data, error } = await resend().emails.send({
      from: config.emailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });
    if (error) {
      console.error("email.send.failed", { via: "resend", code: error.name });
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true, id: data?.id ?? null };
  } catch {
    console.error("email.send.failed", { via: "resend", code: "exception" });
    return { sent: false, reason: "provider_error" };
  }
}
