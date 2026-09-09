"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { signOut } from "@/auth";
import { requireViewer } from "@/lib/auth/session";
import { afterSignOut } from "@/lib/auth/after-sign-in";
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
    await new ProfileService(db()).update(who.id, { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? ""), phone: String(formData.get("phone") ?? ""), marketingOptIn: formData.get("marketingOptIn") === "on" });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/profile");
  return { ok: true, message: "Saved. A changed email or phone is confirmed the next time you sign in with it." };
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
