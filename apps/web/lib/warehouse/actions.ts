"use server";

import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";
import { requireRole } from "@/lib/auth/session";
import { orderService, publicBaseUrl } from "@/lib/orders/context";
import { OrderError } from "@/lib/orders/service";
import { notifyOrderStatus, type FulfilmentStatus } from "@/lib/notify";
import type { ActionResult } from "@/lib/b2b/actions";

function fail(e: unknown): ActionResult {
  if (e instanceof OrderError) return { ok: false, message: e.message };
  console.error("warehouse action failed", e);
  return { ok: false, message: "Something went wrong on our side. Nothing was changed; try again." };
}

function parseKes(raw: string): bigint | null {
  const cleaned = raw.replace(/[,\s]|KES/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
}

/** Tells the customer; failures are logged, never block the warehouse. */
async function notify(orderId: string, status: FulfilmentStatus, extra: { riderName?: string | null; riderPhone?: string | null; receivedBy?: string | null } = {}) {
  try {
    const o = await db().order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    await notifyOrderStatus({ number: o.number, accessToken: o.accessToken, email: o.guestEmail, phone: o.guestPhone, totalMinorUnits: o.totalMinorUnits, paymentMethod: o.paymentMethod, status: o.status, baseUrl: publicBaseUrl(), items: o.items.map((i) => ({ name: i.name, packLabel: i.packLabel, qty: i.qty })) }, status, extra);
  } catch (e) {
    console.error("status notification failed", e);
  }
}

export async function markPackedAction(orderId: string): Promise<ActionResult> {
  const who = await requireRole(["WAREHOUSE", "ADMIN"], `/warehouse/${orderId}`);
  try {
    await orderService().markPacked(orderId, who.id);
  } catch (e) {
    return fail(e);
  }
  await notify(orderId, "PACKED");
  revalidatePath("/warehouse");
  revalidatePath(`/warehouse/${orderId}`);
  return { ok: true, message: "Packed. The customer has been told." };
}

export async function dispatchAction(orderId: string, formData: FormData): Promise<ActionResult> {
  const who = await requireRole(["WAREHOUSE", "ADMIN"], `/warehouse/${orderId}`);
  const rider = { name: String(formData.get("riderName") ?? ""), phone: String(formData.get("riderPhone") ?? "") };
  try {
    await orderService().dispatch(orderId, who.id, rider);
  } catch (e) {
    return fail(e);
  }
  await notify(orderId, "DISPATCHED", { riderName: rider.name.trim(), riderPhone: rider.phone.trim() || null });
  revalidatePath("/warehouse");
  revalidatePath(`/warehouse/${orderId}`);
  return { ok: true, message: `Dispatched with ${rider.name.trim()}. The customer has the rider's details.` };
}

export async function markDeliveredAction(orderId: string, formData: FormData): Promise<ActionResult> {
  const who = await requireRole(["WAREHOUSE", "ADMIN"], `/warehouse/${orderId}`);
  const name = String(formData.get("podName") ?? "");
  const photoUrl = String(formData.get("podPhotoUrl") ?? "").trim() || null;
  try {
    await orderService().markDelivered(orderId, who.id, { name, photoUrl });
  } catch (e) {
    return fail(e);
  }
  await notify(orderId, "DELIVERED", { receivedBy: name.trim() });
  revalidatePath("/warehouse");
  revalidatePath(`/warehouse/${orderId}`);
  return { ok: true, message: "Delivered. The customer has been thanked." };
}

export async function recordCodAction(orderId: string, formData: FormData): Promise<ActionResult> {
  const who = await requireRole(["WAREHOUSE", "ADMIN"], `/warehouse/${orderId}`);
  const amount = parseKes(String(formData.get("amount") ?? ""));
  if (amount === null) return { ok: false, message: "Enter the amount collected in shillings." };
  try {
    await orderService().recordCodCollection(orderId, who.id, { amountMinorUnits: amount, mpesaRef: String(formData.get("mpesaRef") ?? "") });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/warehouse/${orderId}`);
  return { ok: true, message: "Collection recorded." };
}
