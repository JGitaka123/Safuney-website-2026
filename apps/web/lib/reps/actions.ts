"use server";

import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";
import { requireRole } from "@/lib/auth/session";
import { flagEnabled } from "@/lib/flags";

export type RepResult = { ok: true; message: string } | { ok: false; message: string };

const MAX_ACCURACY_M = 500;

/**
 * Records a visit.
 *
 * Location is optional and only ever arrives when the rep tapped "add my location" on the device — the
 * browser will not give it otherwise, and we do not ask for it in the background. A fix worse than
 * half a kilometre is dropped rather than stored: a coordinate that could be any of four buildings is
 * not evidence of a visit, and storing it as though it were is worse than storing nothing.
 */
export async function recordVisitAction(
  customerId: string,
  note: string,
  outcome: string,
  position: { latitude: number; longitude: number; accuracyM: number } | null,
): Promise<RepResult> {
  if (!(await flagEnabled("reps.enabled"))) return { ok: false, message: "Rep mode is not switched on." };
  const who = await requireRole(["SALES", "ADMIN"], "/reps");
  if (!note.trim()) return { ok: false, message: "Write what happened on the visit — it is the whole point of the record." };

  const customer = await db().customer.findUnique({ where: { id: customerId }, select: { displayName: true } });
  if (!customer) return { ok: false, message: "That customer no longer exists." };

  const usable = position && Number.isFinite(position.latitude) && Number.isFinite(position.longitude) && position.accuracyM <= MAX_ACCURACY_M;
  try {
    await db().repVisit.create({
      data: {
        repId: who.id,
        customerId,
        note: note.trim(),
        outcome: outcome.trim() || null,
        ...(usable ? { latitude: position.latitude, longitude: position.longitude, accuracyM: Math.round(position.accuracyM) } : {}),
      },
    });
  } catch (e) {
    console.error("visit note failed", e);
    return { ok: false, message: "Could not save that. Nothing was recorded; try again." };
  }
  revalidatePath("/reps");
  return {
    ok: true,
    message: position && !usable
      ? `Saved for ${customer.displayName}, without the location — the fix was only accurate to ${Math.round(position.accuracyM)} m.`
      : `Saved for ${customer.displayName}.`,
  };
}
