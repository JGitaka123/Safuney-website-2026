"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { KENYAN_COUNTIES, normaliseKenyanMobile } from "@safuney/config";
import * as money from "@safuney/db/money";
import { services } from "@/lib/env";
import { readCart } from "@/lib/cart/cookies";
import { CART_COOKIE } from "@/lib/cart/service";
import { orderService, paymentRegistry, publicBaseUrl } from "@/lib/orders/context";
import { OrderError } from "@/lib/orders/service";
import { notifyOrderPlaced } from "@/lib/notify";
import { db } from "@safuney/db";
import { getSetting } from "@/lib/settings";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter the name of the person placing the order.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address; the order confirmation goes there."),
  phone: z.string().trim().transform((v, ctx) => {
    const n = normaliseKenyanMobile(v);
    if (!n) ctx.addIssue({ code: "custom", message: "That does not look like a Kenyan mobile number. Use 07xx xxx xxx or 01xx xxx xxx." });
    return n ?? "";
  }),
  organisation: z.string().trim().max(160).optional().or(z.literal("")),
});

const deliverySchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("PICKUP"), slot: z.string().max(80).optional() }),
  z.object({
    method: z.literal("DELIVERY"),
    county: z.enum(KENYAN_COUNTIES, { message: "Choose the county." }),
    town: z.string().trim().min(2, "Enter the town or estate.").max(120),
    line1: z.string().trim().max(200).optional().or(z.literal("")),
    landmark: z.string().trim().max(200).optional().or(z.literal("")),
    deliveryNotes: z.string().trim().max(500).optional().or(z.literal("")),
    slot: z.string().max(80).optional(),
  }),
]);

const placeSchema = z.object({
  contact: contactSchema,
  delivery: deliverySchema,
  paymentMethod: z.enum(["MPESA", "CARD", "INVOICE", "COD"]),
  poNumber: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type PlaceOrderInput = z.input<typeof placeSchema>;

export type PlaceOrderResponse =
  | { ok: true; orderNumber: string; accessToken: string; next: { kind: "prompt"; message: string } | { kind: "redirect"; url: string } | { kind: "offline"; instructions: string } }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string> };

export interface CheckoutContext {
  methods: Array<{ method: "MPESA" | "CARD" | "INVOICE" | "COD"; available: boolean; reason?: string }>;
  deliveryConfigured: boolean;
  zones: Array<{ slug: string; name: string; counties: string[]; slots: string[]; leadTimeDays: number }>;
  minimumMinorUnits: string;
}

/** What the checkout page needs to render its options. */
export async function getCheckoutContext(): Promise<CheckoutContext> {
  const registry = paymentRegistry();
  const deliveryConfigured = services.database() ? Boolean(await getSetting("delivery.configured")) : false;
  const zones = services.database() ? await db().deliveryZone.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, counties: true, slots: true, leadTimeDays: true } }) : [];
  const minimum = services.database() ? String(await getSetting("orders.minimumMinorUnits")) : "0";
  return {
    methods: [
      { method: "MPESA", available: registry.MPESA.isConfigured(), reason: registry.MPESA.isConfigured() ? undefined : "M-Pesa payments open once our Paybill is connected." },
      { method: "CARD", available: registry.CARD.isConfigured(), reason: registry.CARD.isConfigured() ? undefined : "Card payments open once our card provider is connected." },
      { method: "COD", available: true },
      { method: "INVOICE", available: false, reason: "For approved credit accounts. Apply for an account and we will switch it on." },
    ],
    deliveryConfigured,
    zones,
    minimumMinorUnits: minimum,
  };
}

/** Delivery fee for the current cart and county (server-computed; the client only displays it). */
export async function quoteDeliveryAction(county: string | null): Promise<{ ok: true; feeLabel: string | null; zone: string | null; free: boolean; slots: string[]; grandTotalLabel: string } | { ok: false; message: string }> {
  if (!services.database()) return { ok: false, message: "Delivery quotes are unavailable right now." };
  const cart = await readCart();
  if (!cart) return { ok: false, message: "Your cart is empty." };
  const q = await orderService().quoteDelivery(cart.weightGrams, cart.subtotalMinorUnits, county);
  if (county && !q.zone) return { ok: false, message: `We do not deliver to ${county} yet. Collect from Mombasa Road, Nairobi, or ask us for a courier quote.` };
  if (county && q.feeMinorUnits === null) return { ok: false, message: "We need to quote delivery for an order this size. Choose collection, or ask us and we will confirm the fee before you pay." };
  const fee = q.feeMinorUnits ?? 0n;
  return { ok: true, feeLabel: q.feeMinorUnits === null ? null : money.formatKes(q.feeMinorUnits), zone: q.zone?.name ?? null, free: q.free, slots: q.zone?.slots ?? [], grandTotalLabel: money.formatKes(cart.totalMinorUnits + fee) };
}

function flatten(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResponse> {
  if (!services.database()) return { ok: false, formError: "Online ordering is not available right now. Call +254 796 808 822 or request a quote." };
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flatten(parsed.error), formError: "Check the highlighted fields." };
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return { ok: false, formError: "Your cart is empty." };
  const d = parsed.data;
  try {
    const result = await orderService().placeOrder({
      cartToken: token,
      contact: { name: d.contact.name, email: d.contact.email, phone: d.contact.phone, organisation: d.contact.organisation || undefined },
      delivery: d.delivery.method === "PICKUP" ? { method: "PICKUP", slot: d.delivery.slot } : { method: "DELIVERY", county: d.delivery.county, town: d.delivery.town, line1: d.delivery.line1 || undefined, landmark: d.delivery.landmark || undefined, deliveryNotes: d.delivery.deliveryNotes || undefined, slot: d.delivery.slot },
      paymentMethod: d.paymentMethod,
      poNumber: d.poNumber || undefined,
      notes: d.notes || undefined,
      baseUrl: publicBaseUrl(),
    });
    // Notify in the background of the request; failures never block the order.
    const order = await db().order.findUnique({ where: { id: result.orderId }, include: { items: true } });
    if (order) {
      void notifyOrderPlaced({ number: order.number, accessToken: order.accessToken, email: order.guestEmail, phone: order.guestPhone, totalMinorUnits: order.totalMinorUnits, paymentMethod: order.paymentMethod, status: order.status, baseUrl: publicBaseUrl(), items: order.items.map((i) => ({ name: i.name, packLabel: i.packLabel, qty: i.qty })) }).catch((e) => console.error("notify failed", e));
    }
    const next = result.next;
    return {
      ok: true,
      orderNumber: result.orderNumber,
      accessToken: result.accessToken,
      next: next.kind === "prompt" ? { kind: "prompt", message: next.message } : next.kind === "redirect" ? { kind: "redirect", url: next.url } : { kind: "offline", instructions: next.instructions },
    };
  } catch (e) {
    if (e instanceof OrderError) {
      const field = e.code === "NO_DELIVERY" ? "delivery.county" : e.code === "METHOD_UNAVAILABLE" ? "paymentMethod" : undefined;
      return { ok: false, formError: e.message, ...(field ? { fieldErrors: { [field]: e.message } } : {}) };
    }
    console.error("placeOrder failed", e);
    return { ok: false, formError: "Something went wrong on our side and the order was not placed. Your cart is saved. Try again in a minute, or call +254 796 808 822." };
  }
}

/** "Didn't get the prompt? Send it again" and card retries. */
export async function retryPaymentAction(orderNumber: string, accessToken: string): Promise<{ ok: true; next: { kind: "prompt"; message: string } | { kind: "redirect"; url: string } | { kind: "offline"; instructions: string } } | { ok: false; message: string }> {
  if (!services.database()) return { ok: false, message: "Unavailable right now." };
  const order = await db().order.findFirst({ where: { number: orderNumber, accessToken } });
  if (!order) return { ok: false, message: "Order not found." };
  try {
    const next = await orderService().initiatePayment(order.id, publicBaseUrl());
    return { ok: true, next: next.kind === "prompt" ? { kind: "prompt", message: next.message } : next.kind === "redirect" ? { kind: "redirect", url: next.url } : { kind: "offline", instructions: next.instructions } };
  } catch (e) {
    return { ok: false, message: e instanceof OrderError ? e.message : "The payment provider did not respond. Try again in a minute." };
  }
}

/** "Pay another way" for an unpaid order: switch method and start collection with it. */
export async function switchPaymentAction(orderNumber: string, accessToken: string, method: "MPESA" | "CARD" | "COD"): Promise<{ ok: true; next: { kind: "prompt"; message: string } | { kind: "redirect"; url: string } | { kind: "offline"; instructions: string } } | { ok: false; message: string }> {
  if (!services.database()) return { ok: false, message: "Unavailable right now." };
  const order = await db().order.findFirst({ where: { number: orderNumber, accessToken } });
  if (!order) return { ok: false, message: "Order not found." };
  try {
    const next = await orderService().switchPaymentMethod(order.id, method, publicBaseUrl());
    return { ok: true, next: next.kind === "prompt" ? { kind: "prompt", message: next.message } : next.kind === "redirect" ? { kind: "redirect", url: next.url } : { kind: "offline", instructions: next.instructions } };
  } catch (e) {
    return { ok: false, message: e instanceof OrderError ? e.message : "The payment provider did not respond. Try again in a minute." };
  }
}
