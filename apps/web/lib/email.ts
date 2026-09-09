/**
 * Transactional email via Resend. Switched off (returns { sent: false }) when RESEND_API_KEY is not set,
 * so callers can decide what "not sent" means for them. Never logs recipients or bodies.
 */
import { Resend } from "resend";
import { config, services } from "./env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export type EmailResult = { sent: true; id: string | null } | { sent: false; reason: "not_configured" | "provider_error" };

let client: Resend | null = null;

function resend(): Resend {
  if (!client) client = new Resend(process.env["RESEND_API_KEY"]);
  return client;
}

/** Send a plain-text email from the site's sender address. */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!services.email()) return { sent: false, reason: "not_configured" };
  try {
    const { data, error } = await resend().emails.send({
      from: config.emailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });
    if (error) {
      console.error("email.send.failed", { code: error.name });
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true, id: data?.id ?? null };
  } catch {
    console.error("email.send.failed", { code: "exception" });
    return { sent: false, reason: "provider_error" };
  }
}
