/**
 * Customer notifications: email via Resend, SMS via Africa's Talking. Both switch themselves off when
 * not configured and log an outcome code only (never the recipient or the body).
 */
import * as money from "@safuney/db/money";
import { sendEmail } from "@/lib/email";
import { site } from "@/config/site";
import { services } from "@/lib/env";

const env = process.env;

export function smsConfigured(): boolean {
  return Boolean(env["AT_API_KEY"] && env["AT_USERNAME"]);
}

export async function sendSms(to: string, message: string): Promise<"sent" | "off" | "failed"> {
  if (!smsConfigured()) return "off";
  try {
    const body = new URLSearchParams({ username: env["AT_USERNAME"]!, to, message, ...(env["AT_SENDER_ID"] ? { from: env["AT_SENDER_ID"] } : {}) });
    const res = await fetch(env["AT_USERNAME"] === "sandbox" ? "https://api.sandbox.africastalking.com/version1/messaging" : "https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: { apiKey: env["AT_API_KEY"]!, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export interface OrderNotification {
  number: string;
  accessToken: string;
  email: string | null;
  phone: string | null;
  totalMinorUnits: bigint;
  paymentMethod: string;
  status: string;
  baseUrl: string;
  items: Array<{ name: string; packLabel: string; qty: number }>;
}

export async function notifyOrderPlaced(o: OrderNotification): Promise<{ email: string; sms: string }> {
  const link = `${o.baseUrl}/orders/${o.number}?token=${o.accessToken}`;
  const total = money.formatKes(o.totalMinorUnits);
  const lines = o.items.map((i) => `${i.qty} × ${i.name} ${i.packLabel}`).join("\n");
  const how =
    o.paymentMethod === "MPESA"
      ? "Pay by M-Pesa when the prompt arrives on your phone."
      : o.paymentMethod === "CARD"
        ? "Pay by card on the secure page."
        : o.paymentMethod === "COD"
          ? "Pay the rider in cash or by M-Pesa on delivery."
          : "Your invoice follows by email.";
  let email = "off";
  if (o.email && services.email()) {
    const r = await sendEmail({
      to: o.email,
      subject: `Order ${o.number} received — ${site.legalName}`,
      text: `Thank you for your order.\n\nOrder ${o.number}\nTotal ${total}\n${how}\n\n${lines}\n\nTrack it here: ${link}\n\nQuestions? Call ${site.contact.phone.display} or reply to this email.\n\n${site.legalName}, ${site.contact.address.lines.join(", ")}`,
    });
    email = r.sent ? "sent" : r.reason;
  }
  const sms = o.phone ? await sendSms(o.phone, `Safuney order ${o.number} received, total ${total}. ${how} Track: ${link}`) : "off";
  return { email, sms };
}

export async function notifyOrderPaid(o: OrderNotification, receipt: string | null): Promise<{ email: string; sms: string }> {
  const link = `${o.baseUrl}/orders/${o.number}?token=${o.accessToken}`;
  const total = money.formatKes(o.totalMinorUnits);
  let email = "off";
  if (o.email && services.email()) {
    const r = await sendEmail({
      to: o.email,
      subject: `Payment received for ${o.number} — ${site.legalName}`,
      text: `We have received ${total} for order ${o.number}${receipt ? ` (receipt ${receipt})` : ""}. We are preparing it now and will tell you when it is dispatched.\n\nTrack it here: ${link}\n\n${site.legalName}`,
    });
    email = r.sent ? "sent" : r.reason;
  }
  const sms = o.phone ? await sendSms(o.phone, `Safuney: payment of ${total} received for ${o.number}${receipt ? ` (${receipt})` : ""}. We are preparing your order. ${link}`) : "off";
  return { email, sms };
}
