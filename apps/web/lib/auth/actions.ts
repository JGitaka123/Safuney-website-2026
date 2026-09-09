"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { db } from "@safuney/db";
import { AFTER_SIGN_IN_PATH, signIn, signOut } from "@/auth";
import { services } from "@/lib/env";
import { getLeadRateLimiter } from "@/lib/rate-limit";
import { afterSignIn, afterSignOut, safeNextPath } from "./after-sign-in";
import { authMockMode } from "./mode";
import { otpIdentifierForEmail, otpIdentifierForPhone, requestOtp } from "./otp";

export type SignInActionResult = { ok: true; mockCode?: string; mockLink?: string } | { ok: false; message: string };

const NOT_CONFIGURED = "Sign-in is not switched on yet. Call us and we will take your order by phone.";

async function limited(key: string): Promise<string | null> {
  const r = await getLeadRateLimiter().limit(`auth:${key}`);
  return r.ok ? null : `Too many attempts. Try again in ${Math.ceil(r.retryAfterSeconds / 60) || 1} minute${r.retryAfterSeconds > 60 ? "s" : ""}.`;
}

/** Emails a one-time link. Always answers the same way for unknown addresses (no account enumeration). */
export async function requestLinkAction(email: string, next: string): Promise<SignInActionResult> {
  if (!services.database()) return { ok: false, message: NOT_CONFIGURED };
  const identifier = otpIdentifierForEmail(email);
  if (!identifier) return { ok: false, message: "Enter the email address you order with." };
  const wait = await limited(identifier);
  if (wait) return { ok: false, message: wait };
  if (!services.email() && !authMockMode()) return { ok: false, message: "Email sign-in is not available right now. Use a code sent by SMS instead." };
  try {
    await signIn("resend", { email: identifier.slice("email:".length), redirect: false, redirectTo: `${AFTER_SIGN_IN_PATH}?next=${encodeURIComponent(safeNextPath(next))}` });
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: "We could not send the link. Try again, or use a code sent by SMS." };
    throw e;
  }
  return { ok: true };
}

/** Sends a six-digit code by SMS (phone) or email. */
export async function requestCodeAction(target: string): Promise<SignInActionResult> {
  if (!services.database()) return { ok: false, message: NOT_CONFIGURED };
  const identifier = target.includes("@") ? otpIdentifierForEmail(target) : otpIdentifierForPhone(target);
  if (!identifier) return { ok: false, message: target.includes("@") ? "Enter a valid email address." : "That does not look like a Kenyan mobile number. Use 07xx xxx xxx or 01xx xxx xxx." };
  const wait = await limited(identifier);
  if (wait) return { ok: false, message: wait };
  const r = await requestOtp(identifier);
  if (!r.ok) return { ok: false, message: r.reason === "not_configured" ? "Codes by SMS are not available right now. Use an emailed link instead." : "Check the number or address and try again." };
  return { ok: true, mockCode: r.mockCode };
}

/** Verifies the code, signs in, merges the cart and returns where the customer was going. */
export async function verifyCodeAction(target: string, code: string, next: string): Promise<SignInActionResult> {
  if (!services.database()) return { ok: false, message: NOT_CONFIGURED };
  try {
    await signIn("otp", { identifier: target, code, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: "That code is wrong or has expired. Ask for a new one." };
    throw e;
  }
  // The session cookie was just set on the response; the request has no session yet, so resolve the user directly.
  const identifier = target.includes("@") ? otpIdentifierForEmail(target) : otpIdentifierForPhone(target);
  const value = identifier?.slice(identifier.indexOf(":") + 1) ?? "";
  const user = identifier?.startsWith("phone:") ? await db().user.findUnique({ where: { phone: value } }) : await db().user.findUnique({ where: { email: value } });
  if (!user) return { ok: false, message: "That code is wrong or has expired. Ask for a new one." };
  await afterSignIn(user.id);
  redirect(safeNextPath(next));
}

export async function staffSignInAction(email: string, password: string, totp: string, next: string): Promise<SignInActionResult> {
  if (!services.database()) return { ok: false, message: NOT_CONFIGURED };
  const wait = await limited(`staff:${email.trim().toLowerCase()}`);
  if (wait) return { ok: false, message: wait };
  try {
    await signIn("staff", { email, password, totp, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: "Email, password or code not recognised." };
    throw e;
  }
  const user = await db().user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { ok: false, message: "Email, password or code not recognised." };
  await afterSignIn(user.id);
  redirect(safeNextPath(next, "/sales"));
}

export async function signOutAction(): Promise<void> {
  await afterSignOut();
  await signOut({ redirect: false });
  redirect("/");
}
