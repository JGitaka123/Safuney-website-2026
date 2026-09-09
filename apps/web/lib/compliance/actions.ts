"use server";

import { revalidatePath } from "next/cache";
import { viewer } from "@/lib/auth/session";
import { flagEnabled } from "@/lib/flags";
import { ComplianceError, subscribe, unsubscribe } from "./service";

export type ComplianceResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Subscribing is an organisation-level act, so the caller's membership decides which organisation —
 * never a value the form sends. The same rule as quote acceptance in Phase 4, for the same reason.
 */
export async function setDocumentSubscriptionAction(documentId: string, wanted: boolean): Promise<ComplianceResult> {
  if (!(await flagEnabled("compliance.enabled"))) return { ok: false, message: "The compliance hub is not available." };
  const who = await viewer();
  if (!who) return { ok: false, message: "Sign in with your organisation account to be told when a sheet changes." };
  const membership = who.memberships[0];
  if (!membership) return { ok: false, message: "Update notifications are for organisation accounts. Ask us to set one up." };
  try {
    if (wanted) await subscribe(membership.customerId, documentId);
    else await unsubscribe(membership.customerId, documentId);
  } catch (e) {
    if (e instanceof ComplianceError) return { ok: false, message: e.message };
    console.error("document subscription failed", e);
    return { ok: false, message: "Something went wrong on our side. Nothing was changed; try again." };
  }
  revalidatePath("/compliance");
  return { ok: true, message: wanted ? `We will email ${membership.customer.displayName} when this sheet is replaced.` : "You will no longer be told when this sheet changes." };
}
