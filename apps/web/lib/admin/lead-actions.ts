"use server";

import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";
import { adminAction, AdminError, type AdminResult } from "./action";

export const markLeadHandled = adminAction(
  "leads.handled",
  "leads.view",
  "Lead",
  async (ctx, leadId: string, handled: boolean): Promise<AdminResult> => {
    const before = await db().lead.findUnique({ where: { id: leadId }, select: { name: true, handledAt: true } });
    if (!before) throw new AdminError("That lead no longer exists.");
    const handledAt = handled ? new Date() : null;
    await db().lead.update({ where: { id: leadId }, data: { handledAt, assignedToId: handled ? ctx.who.id : null } });
    ctx.audit({ entity: "Lead", entityId: leadId, before: { handledAt: before.handledAt }, after: { handledAt } });
    revalidatePath("/admin/leads");
    return { ok: true, message: handled ? "Marked handled." : "Reopened.", id: leadId };
  },
);
