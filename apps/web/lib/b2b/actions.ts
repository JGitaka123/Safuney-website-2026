"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, type MemberRole } from "@safuney/db";
import * as money from "@safuney/db/money";
import { requireViewer } from "@/lib/auth/session";
import { orderService, publicBaseUrl } from "@/lib/orders/context";
import { OrderError } from "@/lib/orders/service";
import { OrganisationError, OrganisationService } from "./organisations";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

function organisations(): OrganisationService {
  return new OrganisationService(db());
}

function fail(e: unknown): ActionResult {
  if (e instanceof OrganisationError || e instanceof OrderError) return { ok: false, message: e.message };
  console.error("b2b action failed", e);
  return { ok: false, message: "Something went wrong on our side. Nothing was changed; try again." };
}

/** Kenyan shillings typed by a person ("25,000" or "25000.50") → minor units. */
function parseKes(raw: string): bigint | null {
  const cleaned = raw.replace(/[,\s]|KES/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
}

export async function createOrganisationAction(formData: FormData): Promise<ActionResult> {
  const who = await requireViewer("/account/organisation/new");
  const threshold = String(formData.get("approvalThreshold") ?? "").trim();
  const thresholdMinor = threshold ? parseKes(threshold) : null;
  if (threshold && thresholdMinor === null) return { ok: false, message: "Enter the approval threshold in shillings, for example 25,000." };
  let id: string;
  try {
    const c = await organisations().create(who.id, { displayName: String(formData.get("displayName") ?? ""), legalName: String(formData.get("legalName") ?? "") || undefined, kraPin: String(formData.get("kraPin") ?? "") || undefined, approvalThresholdMinorUnits: thresholdMinor });
    id = c.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account");
  redirect(`/account/organisation?created=${id}`);
}

export async function updateOrganisationAction(customerId: string, formData: FormData): Promise<ActionResult> {
  const who = await requireViewer("/account/organisation");
  const threshold = String(formData.get("approvalThreshold") ?? "").trim();
  const thresholdMinor = threshold ? parseKes(threshold) : null;
  if (threshold && thresholdMinor === null) return { ok: false, message: "Enter the approval threshold in shillings, for example 25,000." };
  try {
    await organisations().updateSettings(customerId, who.id, { displayName: String(formData.get("displayName") ?? ""), legalName: String(formData.get("legalName") ?? ""), kraPin: String(formData.get("kraPin") ?? ""), approvalThresholdMinorUnits: thresholdMinor });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/organisation");
  return { ok: true, message: "Saved." };
}

export async function inviteMemberAction(customerId: string, formData: FormData): Promise<ActionResult> {
  const who = await requireViewer("/account/organisation");
  const role = String(formData.get("role") ?? "BUYER") as MemberRole;
  if (!["OWNER", "BUYER", "APPROVER"].includes(role)) return { ok: false, message: "Choose a role." };
  try {
    await organisations().invite(customerId, who.id, String(formData.get("email") ?? ""), role);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/organisation");
  return { ok: true, message: "Added. They get access the first time they sign in with that email." };
}

export async function setMemberRoleAction(customerId: string, memberUserId: string, role: MemberRole): Promise<ActionResult> {
  const who = await requireViewer("/account/organisation");
  try {
    await organisations().setMemberRole(customerId, who.id, memberUserId, role);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/organisation");
  return { ok: true };
}

export async function removeMemberAction(customerId: string, memberUserId: string): Promise<ActionResult> {
  const who = await requireViewer("/account/organisation");
  try {
    await organisations().removeMember(customerId, who.id, memberUserId);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/organisation");
  return { ok: true };
}

export async function approveOrderAction(orderId: string): Promise<ActionResult> {
  const who = await requireViewer("/account/approvals");
  try {
    const r = await orderService().approveOrder(orderId, who.id, publicBaseUrl());
    // No revalidation here: the card stays on screen with the outcome; the list refreshes on the next visit.
    return { ok: true, message: r.status === "CONFIRMED" ? "Approved and confirmed." : r.next.kind === "prompt" ? "Approved. The M-Pesa request has been sent to the buyer's phone." : "Approved. The buyer can now pay from the order page." };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectOrderAction(orderId: string, reason: string): Promise<ActionResult> {
  const who = await requireViewer("/account/approvals");
  const why = reason.trim();
  if (why.length < 3) return { ok: false, message: "Tell the buyer why, in a few words." };
  try {
    await orderService().rejectOrder(orderId, who.id, why);
    return { ok: true, message: "Not approved. The stock has been released and the buyer can see your reason on the order." };
  } catch (e) {
    return fail(e);
  }
}

export async function applyForCreditAction(customerId: string, formData: FormData): Promise<ActionResult> {
  const who = await requireViewer("/account/credit");
  const limit = parseKes(String(formData.get("requestedLimit") ?? ""));
  if (limit === null) return { ok: false, message: "Enter the credit limit you are asking for, in shillings." };
  const refs = [1, 2, 3]
    .map((i) => ({ company: String(formData.get(`ref${i}Company`) ?? "").trim(), contact: String(formData.get(`ref${i}Contact`) ?? "").trim(), phone: String(formData.get(`ref${i}Phone`) ?? "").trim() }))
    .filter((r) => r.company || r.contact || r.phone);
  if (refs.some((r) => !r.company || !r.phone)) return { ok: false, message: "Each trade reference needs a company and a phone number." };
  const documents = String(formData.get("documents") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, fileUrl] = l.split("|").map((x) => x.trim());
      return { name: name ?? "", fileUrl: fileUrl ?? "" };
    })
    .filter((d) => d.name && d.fileUrl);
  try {
    await organisations().applyForCredit(customerId, who.id, { legalName: String(formData.get("legalName") ?? ""), kraPin: String(formData.get("kraPin") ?? ""), requestedLimitMinorUnits: limit, requestedTermsDays: Number(formData.get("requestedTermsDays") ?? 30), tradeReferences: refs, documents });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/credit");
  return { ok: true, message: `Application received for ${money.formatKes(limit)}. Finance reviews it within two working days and emails you.` };
}
