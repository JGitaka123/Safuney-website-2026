"use server";

import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";
import { requireRole } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email";
import { config } from "@/lib/env";
import { OrganisationError, OrganisationService } from "./organisations";
import type { ActionResult } from "./actions";

function parseKes(raw: string): bigint | null {
  const cleaned = raw.replace(/[,\s]|KES/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
}

/** Finance decides a credit application; the organisation's owners are emailed either way. */
export async function decideCreditAction(applicationId: string, formData: FormData): Promise<ActionResult> {
  const who = await requireRole(["FINANCE", "ADMIN"], "/sales/credit");
  const approved = String(formData.get("decision")) === "approve";
  const limit = approved ? parseKes(String(formData.get("limit") ?? "")) : null;
  if (approved && limit === null) return { ok: false, message: "Enter the approved limit in shillings." };
  try {
    const app = await new OrganisationService(db()).decideCredit(applicationId, who.id, { approved, limitMinorUnits: limit ?? undefined, termsDays: Number(formData.get("termsDays") ?? 30) || 30, note: String(formData.get("note") ?? "") });
    const owners = await db().customerMember.findMany({ where: { customerId: app.customerId, role: "OWNER" }, include: { user: { select: { email: true } } } });
    for (const o of owners) {
      if (o.user.email) await sendEmail({ to: o.user.email, subject: approved ? "Your Safuney credit account is approved" : "About your Safuney credit application", text: approved ? `Your credit account is open. You can now pay on invoice at checkout within your limit and terms: ${config.siteUrl}/account/credit` : `We could not approve a credit account at this time${app.decisionNote ? `: ${app.decisionNote}` : "."} You can keep ordering with M-Pesa, card or cash on delivery, and apply again later.` });
    }
  } catch (e) {
    if (e instanceof OrganisationError) return { ok: false, message: e.message };
    console.error("credit decision failed", e);
    return { ok: false, message: "Something went wrong on our side. Nothing was changed; try again." };
  }
  revalidatePath("/sales/credit");
  return { ok: true, message: approved ? "Approved. The owners have been emailed." : "Declined. The owners have been emailed." };
}
