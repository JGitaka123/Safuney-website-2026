import { cookies } from "next/headers";
import { db } from "@safuney/db";
import { services } from "@/lib/env";
import { CART_COOKIE, CART_TTL_DAYS, CartService, type CartSummary } from "./service";

/** Non-sensitive mirror of the item count for the header (read client-side). */
export const CART_COUNT_COOKIE = "sfn_cart_count";

export async function writeCartCount(count: number): Promise<void> {
  const jar = await cookies();
  jar.set(CART_COUNT_COOKIE, String(count), { sameSite: "lax", secure: process.env["NODE_ENV"] === "production", path: "/", maxAge: CART_TTL_DAYS * 86_400 });
}

export function cartService(): CartService {
  return new CartService(db());
}

/**
 * Read-only: the current visitor's cart, or null when there is none (never creates one on a GET).
 * A signed-in B2B member sees their organisation's negotiated prices here, not just at checkout.
 */
export async function readCart(customerId?: string): Promise<CartSummary | null> {
  if (!services.database()) return null;
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return null;
  try {
    return await cartService().find(token, customerId);
  } catch (error) {
    console.error("readCart failed", error);
    return null;
  }
}

/** For mutations: returns the token, creating the cart and setting the cookie if needed. */
export async function ensureCartToken(): Promise<string> {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  const cart = await cartService().getOrCreate(token);
  if (cart.token !== token) {
    jar.set(CART_COOKIE, cart.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
      maxAge: CART_TTL_DAYS * 86_400,
    });
  }
  return cart.token;
}
