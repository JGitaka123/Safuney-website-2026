import { cookies } from "next/headers";
import { CART_COOKIE, CART_TTL_DAYS } from "@/lib/cart/service";
import { cartService, writeCartCount } from "@/lib/cart/cookies";
import { services } from "@/lib/env";

/** Plain cookie the static header reads to show "Account" instead of "Sign in". Carries no data. */
export const SIGNED_IN_COOKIE = "sfn_signed_in";

/** Only same-site paths may be used as a return target. */
export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** Merges the guest cart into the user's cart and points the cart cookie at it; marks the header. */
export async function afterSignIn(userId: string): Promise<void> {
  const jar = await cookies();
  const secure = process.env["NODE_ENV"] === "production";
  jar.set(SIGNED_IN_COOKIE, "1", { sameSite: "lax", secure, path: "/", maxAge: 30 * 86_400 });
  if (!services.database()) return;
  const guestToken = jar.get(CART_COOKIE)?.value;
  const cart = guestToken ? await cartService().mergeInto(guestToken, userId) : await cartService().getOrCreate(undefined, userId);
  jar.set(CART_COOKIE, cart.token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: CART_TTL_DAYS * 86_400 });
  await writeCartCount(cart.itemCount);
}

export async function afterSignOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SIGNED_IN_COOKIE);
  jar.delete(CART_COOKIE);
  await writeCartCount(0);
}
