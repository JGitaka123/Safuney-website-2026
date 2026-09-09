"use server";

import { db } from "@safuney/db";
import { flagEnabled } from "@/lib/flags";
import { plan, MAX_UNITS, type Plan } from "./model";

export type PlannerResult = { ok: true; plan: Plan } | { ok: false; message: string };

export async function estimateAction(facility: string, unitsRaw: string): Promise<PlannerResult> {
  if (!(await flagEnabled("planner.enabled"))) return { ok: false, message: "The planner is not available right now." };
  if (!/^\d+$/.test(unitsRaw.trim())) return { ok: false, message: "Enter the size as a whole number." };
  const units = Number.parseInt(unitsRaw, 10);
  if (units < 1) return { ok: false, message: "Enter a size of at least 1." };
  if (units > MAX_UNITS) return { ok: false, message: `That is larger than the planner handles. Talk to us directly about a site of that size.` };
  const result = plan(facility, units);
  if (!result) return { ok: false, message: "Pick a facility type." };
  return { ok: true, plan: result };
}

/**
 * Records a plan someone asked us to follow up on. The planner is a lead magnet as much as a tool, and
 * a buyer who has told us their facility type and size has told us most of what a quote needs.
 */
export async function plannerLeadAction(facility: string, units: number, contact: { name: string; email: string; phone: string; organisation: string }): Promise<{ ok: boolean; message: string }> {
  if (!(await flagEnabled("planner.enabled"))) return { ok: false, message: "The planner is not available right now." };
  if (!contact.name.trim()) return { ok: false, message: "Tell us who to reply to." };
  if (!contact.email.trim() && !contact.phone.trim()) return { ok: false, message: "Leave us an email address or a phone number, so we can send it." };
  const estimate = plan(facility, units);
  if (!estimate) return { ok: false, message: "Pick a facility type first." };
  try {
    await db().lead.create({
      data: {
        kind: "PLANNER",
        name: contact.name.trim(),
        email: contact.email.trim() || null,
        phone: contact.phone.trim() || null,
        organisation: contact.organisation.trim() || null,
        message: `Hygiene plan for a ${estimate.facility.name.toLowerCase()} — ${estimate.units} ${estimate.facility.unitLabel.toLowerCase()}.`,
        payload: {
          facility: estimate.facility.slug,
          units: estimate.units,
          totalConcentrateLitres: estimate.totalConcentrateLitres,
          tasks: estimate.tasks.map((t) => ({ task: t.key, concentrateLitres: t.concentrateLitres, ratio: t.ratio })),
        },
        source: "/planner",
        consentAt: new Date(),
      },
    });
  } catch (e) {
    console.error("planner lead failed", e);
    return { ok: false, message: "We could not send that just now. Try again, or call us." };
  }
  return { ok: true, message: "Sent. We will come back with a priced order sheet built from this plan." };
}
