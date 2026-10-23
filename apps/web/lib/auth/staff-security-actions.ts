"use server";

import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { signOut } from "@/auth";
import { requireRole } from "@/lib/auth/session";
import { afterSignOut } from "@/lib/auth/after-sign-in";
import { getLeadRateLimiter } from "@/lib/rate-limit";
import { SecurityError, StaffSecurityService } from "./staff-security";
import type { ActionResult } from "@/lib/b2b/actions";

const STAFF = ["SALES", "WAREHOUSE", "FINANCE", "ADMIN"] as const;
const PATH = "/account/security";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

/** Each attempt checks the current password, so it is limited like a sign-in. */
async function limited(userId: string): Promise<ActionResult | null> {
  const r = await getLeadRateLimiter().limit(`security:${userId}`);
  return r.ok ? null : { ok: false, message: `Too many attempts. Try again in ${Math.ceil(r.retryAfterSeconds / 60) || 1} minute${r.retryAfterSeconds > 60 ? "s" : ""}.` };
}

async function run(change: (service: StaffSecurityService, userId: string) => Promise<void>, done: string): Promise<ActionResult> {
  const who = await requireRole([...STAFF], PATH);
  const wait = await limited(who.id);
  if (wait) return wait;
  try {
    await change(new StaffSecurityService(db()), who.id);
  } catch (e) {
    if (e instanceof SecurityError) return { ok: false, message: e.message };
    console.error("staff security change failed", e);
    return { ok: false, message: "Something went wrong on our side. Nothing was changed; try again." };
  }
  // The change has ended this session too (credentialsChangedAt); sign in again with the new details.
  await afterSignOut();
  await signOut({ redirect: false });
  redirect(`/sign-in/staff?changed=${done}`);
}

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  return run(
    (s, id) => s.changePassword(id, { currentPassword: field(formData, "currentPassword"), currentCode: field(formData, "currentCode"), newPassword: field(formData, "newPassword"), confirmPassword: field(formData, "confirmPassword") }),
    "password",
  );
}

export async function changeAuthenticatorAction(formData: FormData): Promise<ActionResult> {
  return run(
    (s, id) => s.changeAuthenticator(id, { currentPassword: field(formData, "currentPassword"), currentCode: field(formData, "currentCode"), newKey: field(formData, "newKey"), newCode: field(formData, "newCode") }),
    "authenticator",
  );
}
