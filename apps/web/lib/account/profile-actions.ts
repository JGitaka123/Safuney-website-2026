"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { signOut } from "@/auth";
import { isStaff, requireViewer } from "@/lib/auth/session";
import { afterSignIn, afterSignOut } from "@/lib/auth/after-sign-in";
import { requestOtp, verifyOtp } from "@/lib/auth/otp";
import { getLeadRateLimiter } from "@/lib/rate-limit";
import { confirmContact, type ContactKind } from "./contacts";
import { ProfileError, ProfileService } from "./profile";
import type { ActionResult } from "@/lib/b2b/actions";

function fail(e: unknown): ActionResult {
  if (e instanceof ProfileError) return { ok: false, message: e.message };
  console.error("profile action failed", e);
  return { ok: false, message: "Something went wrong on our side. Nothing was changed; try again." };
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const who = await requireViewer("/account/profile");
  try {
    await new ProfileService(db()).update(who.id, { name: String(formData.get("name") ?? ""), marketingOptIn: formData.get("marketingOptIn") === "on" });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/profile");
  return { ok: true, message: "Saved." };
}

export type ContactCodeResult = { ok: true; mockCode?: string } | { ok: false; message: string };

/** Staff sign in with their email and password, so their email is changed by an admin, not here. */
async function contactFor(kind: ContactKind, raw: string): Promise<{ userId: string; identifier: string } | { message: string }> {
  const who = await requireViewer("/account/profile");
  if (kind !== "email" && kind !== "phone") return { message: "Check it and try again." };
  if (kind === "email" && isStaff(who.role)) return { message: "Staff sign in with this email address. Ask an admin to change it." };
  try {
    return { userId: who.id, identifier: ProfileService.parseContact(kind, raw) };
  } catch (e) {
    return { message: fail(e).message ?? "Check it and try again." };
  }
}

/** Sends a code to a new email or phone; nothing on the account changes until the code is entered. */
export async function requestContactCodeAction(kind: ContactKind, raw: string): Promise<ContactCodeResult> {
  const c = await contactFor(kind, raw);
  if ("message" in c) return { ok: false, message: c.message };
  const r = await getLeadRateLimiter().limit(`auth:add:${c.userId}`);
  if (!r.ok) return { ok: false, message: `Too many codes asked for. Try again in ${Math.ceil(r.retryAfterSeconds / 60) || 1} minutes.` };
  const sent = await requestOtp(c.identifier, { kind: "add-contact", userId: c.userId });
  if (!sent.ok) return { ok: false, message: kind === "phone" ? "We could not send an SMS just now. Try again in a minute, or call us." : "We could not send the email just now. Try again in a minute, or call us." };
  return { ok: true, mockCode: sent.mockCode };
}

/** Checks the code, then adds the contact (merging in another customer account that held it). */
export async function confirmContactAction(kind: ContactKind, raw: string, code: string): Promise<ActionResult> {
  const c = await contactFor(kind, raw);
  if ("message" in c) return { ok: false, message: c.message };
  if (!/^\d{6}$/.test(code.trim())) return { ok: false, message: "Enter the six-digit code." };
  const v = await verifyOtp(c.identifier, code, { kind: "add-contact", userId: c.userId });
  if (!v.ok) return { ok: false, message: v.reason === "wrong" ? "That code is wrong. Check it and try again." : "That code has expired. Ask for a new one." };
  let merged = false;
  try {
    ({ merged } = await confirmContact(db(), c.userId, kind, c.identifier.slice(c.identifier.indexOf(":") + 1)));
  } catch (e) {
    return fail(e);
  }
  // Guest orders placed with this contact now belong here; the cart cookie follows any cart that moved in.
  await afterSignIn(c.userId);
  revalidatePath("/account", "layout");
  const what = kind === "email" ? "email address" : "number";
  return { ok: true, message: merged ? `Done. That ${what} had its own account; its orders, addresses and lists are now in this one, and you sign in to this account with either.` : `Done. You can now sign in with this ${what}.` };
}

export async function removeContactAction(kind: ContactKind): Promise<ActionResult> {
  const who = await requireViewer("/account/profile");
  if (kind !== "email" && kind !== "phone") return { ok: false, message: "Nothing was changed." };
  try {
    await new ProfileService(db()).removeContact(who.id, kind);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/profile");
  return { ok: true, message: kind === "email" ? "Email address removed." : "Number removed." };
}

export async function deleteAccountAction(formData: FormData): Promise<ActionResult> {
  const who = await requireViewer("/account/profile");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { ok: false, message: "Type DELETE to confirm." };
  try {
    await new ProfileService(db()).deleteAccount(who.id);
  } catch (e) {
    return fail(e);
  }
  await afterSignOut();
  await signOut({ redirect: false });
  redirect("/?deleted=1");
}
