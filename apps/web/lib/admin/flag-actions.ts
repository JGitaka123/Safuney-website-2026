"use server";

import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";
import { FLAGS, type FlagKey } from "@/lib/flags";
import { adminAction, AdminError, type AdminResult } from "./action";

/**
 * Turns a feature on or off for everyone.
 *
 * Through the audited seam, so switching a feature on is a recorded act with a name against it — which
 * matters when a feature that touches money or customer data appears on the live site and someone has
 * to say who decided that.
 */
export const setFeatureFlag = adminAction(
  "flags.set",
  "staff.write",
  "FeatureFlag",
  async (ctx, key: string, enabled: boolean): Promise<AdminResult> => {
    if (!(key in FLAGS)) throw new AdminError("That is not a feature we know about.");
    const flagKey = key as FlagKey;
    const before = await db().featureFlag.findUnique({ where: { key: flagKey }, select: { enabled: true } });
    await db().featureFlag.upsert({
      where: { key: flagKey },
      create: { key: flagKey, enabled, description: FLAGS[flagKey] },
      update: { enabled, description: FLAGS[flagKey] },
    });
    ctx.audit({ entity: "FeatureFlag", entityId: key, before: { enabled: before?.enabled ?? false }, after: { enabled } });
    // Every page that checks a flag is affected, so the whole tree is revalidated rather than guessing.
    revalidatePath("/", "layout");
    return { ok: true, message: enabled ? "Switched on for everyone." : "Switched off.", id: key };
  },
);
