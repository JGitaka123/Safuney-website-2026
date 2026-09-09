"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { requireViewer } from "@/lib/auth/session";
import { cartService, ensureCartToken, writeCartCount } from "@/lib/cart/cookies";
import { ListError, SavedListService } from "./lists";
import type { ActionResult } from "./actions";

function lists(): SavedListService {
  return new SavedListService(db());
}

function fail(e: unknown): ActionResult {
  if (e instanceof ListError) return { ok: false, message: e.message };
  console.error("list action failed", e);
  return { ok: false, message: "Something went wrong on our side. Nothing was changed; try again." };
}

export async function createListAction(formData: FormData): Promise<ActionResult> {
  const who = await requireViewer("/account/lists");
  let id: string;
  try {
    const l = await lists().create(who.id, String(formData.get("name") ?? ""));
    id = l.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/lists");
  redirect(`/account/lists/${id}`);
}

export async function saveOrderAsListAction(orderId: string, name: string): Promise<ActionResult & { listId?: string }> {
  const who = await requireViewer("/account");
  try {
    const l = await lists().fromOrder(who.id, orderId, name);
    revalidatePath("/account/lists");
    return { ok: true, message: `Saved as "${l.name}".`, listId: l.id };
  } catch (e) {
    return fail(e);
  }
}

export async function setListItemAction(listId: string, variantId: string, qty: number): Promise<ActionResult> {
  const who = await requireViewer(`/account/lists/${listId}`);
  try {
    await lists().setItem(who.id, listId, variantId, qty);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/account/lists/${listId}`);
  return { ok: true };
}

export async function renameListAction(listId: string, formData: FormData): Promise<ActionResult> {
  const who = await requireViewer(`/account/lists/${listId}`);
  try {
    await lists().rename(who.id, listId, String(formData.get("name") ?? ""));
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/account/lists/${listId}`);
  return { ok: true, message: "Renamed." };
}

export async function deleteListAction(listId: string): Promise<ActionResult> {
  const who = await requireViewer("/account/lists");
  try {
    await lists().remove(who.id, listId);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/lists");
  redirect("/account/lists");
}

/** "Add all to cart" from a list; the failures name the packs that could not be added and why. */
export async function addListToCartAction(listId: string): Promise<ActionResult & { failures?: Array<{ variantId: string; message: string }>; itemCount?: number }> {
  const who = await requireViewer(`/account/lists/${listId}`);
  try {
    const list = await lists().get(who.id, listId);
    const token = await ensureCartToken();
    const failures = await lists().addToCart(cartService(), token, list.items.map((i) => ({ variantId: i.variantId, qty: i.qty })));
    const cart = await cartService().find(token);
    await writeCartCount(cart?.itemCount ?? 0);
    const added = list.items.length - failures.length;
    return { ok: true, message: failures.length === 0 ? `Added ${added} line${added === 1 ? "" : "s"} to your cart.` : `Added ${added} of ${list.items.length} lines. The rest need attention below.`, failures, itemCount: cart?.itemCount ?? 0 };
  } catch (e) {
    return fail(e);
  }
}

/** One-click reorder from an order: same lines, current prices and stock. */
export async function reorderAction(orderId: string): Promise<ActionResult & { failures?: Array<{ name: string; message: string }> }> {
  const who = await requireViewer("/account");
  const order = await db().order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.userId !== who.id) return { ok: false, message: "Order not found." };
  const token = await ensureCartToken();
  const failures: Array<{ name: string; message: string }> = [];
  for (const item of order.items) {
    if (!item.variantId) {
      failures.push({ name: `${item.name} ${item.packLabel}`, message: "No longer in the catalogue." });
      continue;
    }
    try {
      await cartService().add(token, item.variantId, item.qty);
    } catch (e) {
      failures.push({ name: `${item.name} ${item.packLabel}`, message: e instanceof Error ? e.message : "Could not be added." });
    }
  }
  const cart = await cartService().find(token);
  await writeCartCount(cart?.itemCount ?? 0);
  const added = order.items.length - failures.length;
  return { ok: true, message: failures.length === 0 ? `Added ${added} line${added === 1 ? "" : "s"} to your cart.` : `Added ${added} of ${order.items.length} lines.`, failures };
}
