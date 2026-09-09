"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { normaliseKenyanMobile } from "@safuney/config";
import { services } from "@/lib/env";
import { viewer, requireRole } from "@/lib/auth/session";
import { readCart } from "@/lib/cart/cookies";
import { orderService, publicBaseUrl } from "@/lib/orders/context";
import { OrderError } from "@/lib/orders/service";
import { getLeadRateLimiter } from "@/lib/rate-limit";
import { organisationFor } from "@/lib/checkout/actions";
import { QuoteError, QuoteService } from "./quotes";
import type { ActionResult } from "./actions";

function quotes(): QuoteService {
  return new QuoteService(db(), orderService());
}

function fail(e: unknown): ActionResult {
  if (e instanceof QuoteError || e instanceof OrderError) return { ok: false, message: e.message };
  console.error("quote action failed", e);
  return { ok: false, message: "Something went wrong on our side. Nothing was sent; try again." };
}

function parseKes(raw: string): bigint | null {
  const cleaned = raw.replace(/[,\s]|KES/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
}

/** Customer or guest asks for a quote: free-text lines plus, optionally, the current cart. */
export async function requestQuoteAction(formData: FormData): Promise<ActionResult & { number?: string }> {
  if (!services.database()) return { ok: false, message: "Quotes are not available online right now. Call +254 796 808 822 and we will quote by phone." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const limit = await getLeadRateLimiter().limit(`quote:${email || "anon"}`);
  if (!limit.ok) return { ok: false, message: "Too many requests. Try again in a few minutes." };
  const phone = normaliseKenyanMobile(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, message: "That does not look like a Kenyan mobile number. Use 07xx xxx xxx or 01xx xxx xxx." };
  const lines: Array<{ variantId?: string; description: string; qty: number }> = [];
  if (formData.get("includeCart") === "on") {
    const cart = await readCart();
    for (const l of cart?.lines ?? []) lines.push({ variantId: l.variantId, description: `${l.name} ${l.packLabel}`, qty: l.qty });
  }
  for (let i = 1; i <= 5; i++) {
    const d = String(formData.get(`line${i}`) ?? "").trim();
    if (d) lines.push({ description: d, qty: Number(formData.get(`qty${i}`) ?? 1) || 1 });
  }
  const who = await viewer();
  const org = who ? await organisationFor(who) : null;
  try {
    const q = await quotes().request({ contactName: String(formData.get("name") ?? ""), contactEmail: email, contactPhone: phone.startsWith("+") ? phone : `+254${phone.replace(/^0/, "")}`, organisation: String(formData.get("organisation") ?? "") || org?.name, notes: String(formData.get("notes") ?? ""), lines, userId: who?.id, customerId: org?.id, source: "/quote" });
    return { ok: true, message: `Request ${q.number} received. We price quotes within one working day and email you a link to accept.`, number: q.number };
  } catch (e) {
    return fail(e);
  }
}

export async function priceQuoteAction(id: string, formData: FormData): Promise<ActionResult> {
  const who = await requireRole(["SALES", "ADMIN"], `/sales/quotes/${id}`);
  const lines: Array<{ itemId: string; variantId: string; unitPriceMinorUnits: bigint; qty: number }> = [];
  for (const [key, value] of formData.entries()) {
    const m = /^price:(.+)$/.exec(key);
    if (!m) continue;
    const itemId = m[1]!;
    const price = parseKes(String(value));
    if (price === null) return { ok: false, message: "Enter every unit price in shillings, ex VAT." };
    const sku = String(formData.get(`sku:${itemId}`) ?? "").trim().toUpperCase();
    const variant = sku ? await db().productVariant.findUnique({ where: { sku }, select: { id: true } }) : null;
    if (!variant) return { ok: false, message: `SKU "${sku}" was not found. Every line needs a catalogue pack so the accepted quote can become an order.` };
    lines.push({ itemId, variantId: variant.id, unitPriceMinorUnits: price, qty: Number(formData.get(`qty:${itemId}`) ?? 1) || 1 });
  }
  try {
    await quotes().price(who.id, id, { lines, validDays: Number(formData.get("validDays") ?? 14) || 14, salesNote: String(formData.get("salesNote") ?? "") });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/sales/quotes/${id}`);
  revalidatePath("/sales/quotes");
  return { ok: true, message: "Priced and sent. The customer has the link to accept." };
}

export async function acceptQuoteAction(number: string, token: string, formData: FormData): Promise<ActionResult> {
  const method = String(formData.get("paymentMethod") ?? "COD") as "MPESA" | "CARD" | "COD" | "INVOICE";
  if (!["MPESA", "CARD", "COD", "INVOICE"].includes(method)) return { ok: false, message: "Choose how to pay." };
  const who = await viewer();
  const org = who ? await organisationFor(who) : null;
  let next: string;
  try {
    const r = await quotes().accept(number, token, { delivery: { method: "PICKUP" }, paymentMethod: method, poNumber: String(formData.get("poNumber") ?? "") || undefined, userId: who?.id, customerId: org?.id, placedByRole: org?.role, baseUrl: publicBaseUrl() });
    next = r.next.kind === "redirect" ? r.next.url : `/orders/${r.orderNumber}?token=${r.accessToken}`;
  } catch (e) {
    return fail(e);
  }
  redirect(next);
}

export async function declineQuoteAction(number: string, token: string, formData: FormData): Promise<ActionResult> {
  try {
    await quotes().decline(number, token, String(formData.get("reason") ?? ""));
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/quotes/${number}`);
  return { ok: true, message: "Declined. Thank you for telling us." };
}
