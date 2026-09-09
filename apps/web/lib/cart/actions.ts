"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { services } from "@/lib/env";
import { cartService, ensureCartToken, writeCartCount } from "./cookies";
import { CartError, MAX_QTY } from "./service";

export type CartActionResult =
  | { ok: true; itemCount: number; message: string }
  | { ok: false; message: string; failures?: Array<{ variantId: string; message: string }> };

const lineSchema = z.object({ variantId: z.string().min(1).max(64), qty: z.coerce.number().int().min(1).max(MAX_QTY) });

const OFFLINE = "Online ordering is not switched on yet. Call +254 796 808 822 or request a quote.";

function fail(e: unknown): CartActionResult {
  if (e instanceof CartError) return { ok: false, message: e.message };
  console.error("cart action failed", e);
  return { ok: false, message: "Something went wrong on our side and the cart was not updated. Try again in a minute." };
}

/** Add one line. Called from the product page and search results. */
export async function addToCart(input: { variantId: string; qty: number }): Promise<CartActionResult> {
  if (!services.database()) return { ok: false, message: OFFLINE };
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: `Choose a quantity between 1 and ${MAX_QTY}.` };
  try {
    const token = await ensureCartToken();
    const cart = await cartService().add(token, parsed.data.variantId, parsed.data.qty);
    await writeCartCount(cart.itemCount);
    revalidatePath("/cart");
    return { ok: true, itemCount: cart.itemCount, message: "Added to cart" };
  } catch (e) {
    return fail(e);
  }
}

/** Set a line's quantity (0 removes). Called from the cart page. */
export async function setCartQty(input: { variantId: string; qty: number }): Promise<CartActionResult> {
  if (!services.database()) return { ok: false, message: OFFLINE };
  const parsed = z.object({ variantId: z.string().min(1).max(64), qty: z.coerce.number().int().min(0).max(MAX_QTY) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: `Choose a quantity between 0 and ${MAX_QTY}.` };
  try {
    const token = await ensureCartToken();
    const cart = await cartService().setQty(token, parsed.data.variantId, parsed.data.qty);
    await writeCartCount(cart.itemCount);
    revalidatePath("/cart");
    return { ok: true, itemCount: cart.itemCount, message: parsed.data.qty === 0 ? "Removed from cart" : "Cart updated" };
  } catch (e) {
    return fail(e);
  }
}

/** Add many lines at once (order sheet). Lines that cannot be added are reported, the rest go in. */
export async function addManyToCart(input: Array<{ variantId: string; qty: number }>): Promise<CartActionResult> {
  if (!services.database()) return { ok: false, message: OFFLINE };
  const parsed = z.array(lineSchema).min(1).max(500).safeParse(input.filter((l) => Number(l.qty) > 0));
  if (!parsed.success) return { ok: false, message: "Enter a quantity next to at least one product." };
  try {
    const token = await ensureCartToken();
    const { cart, failures } = await cartService().addMany(token, parsed.data);
    await writeCartCount(cart.itemCount);
    revalidatePath("/cart");
    const added = parsed.data.length - failures.length;
    if (added === 0) return { ok: false, message: "Nothing could be added.", failures };
    return { ok: true, itemCount: cart.itemCount, message: failures.length ? `${added} added; ${failures.length} could not be added.` : `${added} line${added === 1 ? "" : "s"} added to cart`, ...(failures.length ? { failures } : {}) };
  } catch (e) {
    return fail(e);
  }
}
