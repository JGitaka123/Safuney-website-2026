import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@safuney/db";
import { normaliseKenyanMobile } from "@safuney/config";
import { sendSms, smsConfigured } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { config, services } from "@/lib/env";
import { authMockMode } from "./mode";

export const OTP_TTL_MINUTES = 10;
export const OTP_LENGTH = 6;
/** Failed attempts tolerated per code before it is discarded. */
export const OTP_MAX_ATTEMPTS = 5;

function hashCode(identifier: string, code: string): string {
  return createHash("sha256").update(`${identifier}:${code}:${process.env["AUTH_SECRET"] || "dev"}`).digest("hex");
}

export type OtpRequestResult =
  | { ok: true; channel: "sms" | "email"; /** Only in mock mode: the code, so previews and tests can complete the flow. */ mockCode?: string }
  | { ok: false; reason: "invalid_phone" | "invalid_email" | "not_configured" };

/** Phone in E.164 (+2547…); the identifier stored against the code. */
export function otpIdentifierForPhone(phone: string): string | null {
  const normalised = normaliseKenyanMobile(phone);
  if (!normalised) return null;
  // normaliseKenyanMobile returns E.164 (+2547…); accept a 07… form defensively.
  return `phone:${normalised.startsWith("+") ? normalised : `+254${normalised.replace(/^0/, "")}`}`;
}

export function otpIdentifierForEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? `email:${e}` : null;
}

/**
 * Issues a one-time code for a phone (SMS) or an email (when the customer prefers a code to a link).
 * The code itself is never stored: only a keyed hash, with an attempt counter folded into the token
 * row so a brute force burns the code, not the account.
 */
export async function requestOtp(identifier: string, purpose: OtpPurpose = { kind: "sign-in" }): Promise<OtpRequestResult> {
  const [kind, target] = identifier.split(":", 2) as ["phone" | "email", string];
  const mock = authMockMode();
  if (kind === "phone" && !smsConfigured() && !mock) return { ok: false, reason: "not_configured" };
  if (kind === "email" && !services.email() && !mock) return { ok: false, reason: "not_configured" };

  const code = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
  const key = otpKey(identifier, purpose);
  await db().verificationToken.deleteMany({ where: { identifier: key } });
  await db().verificationToken.create({ data: { identifier: key, token: `${hashCode(key, code)}:0`, expires } });

  const what = purpose.kind === "sign-in" ? "sign-in code" : `code to add this ${kind === "phone" ? "number" : "address"} to your account`;
  const message = `${code} is your Safuney ${what}. It expires in ${OTP_TTL_MINUTES} minutes. Never share it.`;
  if (mock) {
    console.info(`[auth mock] code for ${key}: ${code}`);
    return { ok: true, channel: kind === "phone" ? "sms" : "email", mockCode: code };
  }
  if (kind === "phone") {
    const r = await sendSms(target, message);
    if (r === "failed") return { ok: false, reason: "not_configured" };
    return { ok: true, channel: "sms" };
  }
  const subject = purpose.kind === "sign-in" ? `${code} is your Safuney sign-in code` : `${code} is your Safuney code to add this address`;
  const footer = purpose.kind === "sign-in" ? `${config.siteUrl}/sign-in` : "If you did not ask to add this address to a Safuney account, ignore this email.";
  const sent = await sendEmail({ to: target, subject, text: `${message}\n\n${footer}` });
  // Telling someone a code is on its way when the mail server refused it leaves them waiting for nothing.
  if (!sent.sent) return { ok: false, reason: "not_configured" };
  return { ok: true, channel: "email" };
}

export type OtpVerifyResult = { ok: true } | { ok: false; reason: "expired" | "wrong" | "too_many" };

/**
 * What a code is for. A code to add a contact is stored under the account it was asked from, so it
 * cannot be used to sign in, and a sign-in code cannot be used to add the contact to another account.
 */
export type OtpPurpose = { kind: "sign-in" } | { kind: "add-contact"; userId: string };

function otpKey(identifier: string, purpose: OtpPurpose): string {
  return purpose.kind === "sign-in" ? identifier : `add:${purpose.userId}:${identifier}`;
}

/** Checks and consumes a code. Wrong codes count; after OTP_MAX_ATTEMPTS the code is deleted. */
export async function verifyOtp(contact: string, code: string, purpose: OtpPurpose = { kind: "sign-in" }): Promise<OtpVerifyResult> {
  const identifier = otpKey(contact, purpose);
  const row = await db().verificationToken.findFirst({ where: { identifier } });
  if (!row) return { ok: false, reason: "expired" };
  if (row.expires.getTime() < Date.now()) {
    await db().verificationToken.deleteMany({ where: { identifier } });
    return { ok: false, reason: "expired" };
  }
  const [storedHash, attemptsRaw] = row.token.split(":");
  const attempts = Number(attemptsRaw ?? 0);
  const expected = Buffer.from(hashCode(identifier, code.trim()));
  const actual = Buffer.from(storedHash ?? "");
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (match) {
    await db().verificationToken.deleteMany({ where: { identifier } });
    return { ok: true };
  }
  if (attempts + 1 >= OTP_MAX_ATTEMPTS) {
    await db().verificationToken.deleteMany({ where: { identifier } });
    return { ok: false, reason: "too_many" };
  }
  await db().verificationToken.update({ where: { identifier_token: { identifier, token: row.token } }, data: { token: `${storedHash}:${attempts + 1}` } });
  return { ok: false, reason: "wrong" };
}
