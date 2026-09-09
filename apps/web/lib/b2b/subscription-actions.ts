"use server";

import { revalidatePath } from "next/cache";
import { db, type PaymentMethod } from "@safuney/db";
import { requireViewer } from "@/lib/auth/session";
import { readCart } from "@/lib/cart/cookies";
import { AddressService } from "@/lib/account/addresses";
import { orderService } from "@/lib/orders/context";
import { SubscriptionError, SubscriptionService } from "./subscriptions";
import type { ActionResult } from "./actions";

function subscriptions(): SubscriptionService {
  return new SubscriptionService(db(), orderService());
}

function fail(e: unknown): ActionResult {
  if (e instanceof SubscriptionError) return { ok: false, message: e.message };
  console.error("subscription action failed", e);
  return { ok: false, message: "Something went wrong on our side. Nothing was changed; try again." };
}

/** Turns the current cart into a schedule. */
export async function scheduleFromCartAction(formData: FormData): Promise<ActionResult> {
  const who = await requireViewer("/account/deliveries");
  const cart = await readCart();
  if (!cart || cart.lines.length === 0) return { ok: false, message: "Your cart is empty. Add the packs you want delivered on a schedule, then come back here." };
  const method = String(formData.get("paymentMethod") ?? "COD") as PaymentMethod;
  if (!["MPESA", "CARD", "COD", "INVOICE"].includes(method)) return { ok: false, message: "Choose how each delivery is paid." };
  const first = new Date(String(formData.get("firstRunAt") ?? ""));
  if (Number.isNaN(first.getTime())) return { ok: false, message: "Choose the first delivery date." };
  const addressId = String(formData.get("addressId") ?? "") || null;
  if (addressId) {
    const mine = await new AddressService(db()).listFor(who.id);
    if (!mine.some((a) => a.id === addressId)) return { ok: false, message: "Choose one of your saved addresses, or collection." };
  }
  try {
    await subscriptions().create(who.id, { intervalDays: Number(formData.get("intervalDays") ?? 28), firstRunAt: first, paymentMethod: method, addressId, items: cart.lines.map((l) => ({ variantId: l.variantId, qty: l.qty })) });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/deliveries");
  return { ok: true, message: "Scheduled. We email you three days before each delivery; you can skip or pause any time." };
}

export async function setScheduleStatusAction(id: string, status: "ACTIVE" | "PAUSED" | "CANCELLED"): Promise<ActionResult> {
  const who = await requireViewer("/account/deliveries");
  try {
    await subscriptions().setStatus(who.id, id, status);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/deliveries");
  return { ok: true };
}

export async function skipNextDeliveryAction(id: string): Promise<ActionResult> {
  const who = await requireViewer("/account/deliveries");
  try {
    await subscriptions().skipNext(who.id, id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/deliveries");
  return { ok: true, message: "Skipped. The next delivery moves one interval on." };
}
