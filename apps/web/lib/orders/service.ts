/**
 * Order placement and payment lifecycle.
 *
 * Non-negotiables enforced here:
 *  #1 the server is the price authority: totals are recomputed from ProductVariant rows inside the
 *     transaction; the client only sends variant ids and quantities via its cart.
 *  #3 no negative stock: reservations are made in the same transaction that creates the order, and the
 *     database CHECK constraints are the last line of defence.
 *  #4 callbacks are verified by the adapter and made idempotent by WebhookEvent.eventKey (unique).
 *  #5 every status change appends an OrderEvent; nothing is overwritten.
 */
import * as money from "@safuney/db/money";
import { Prisma, type OrderStatus, type PaymentMethod, type PrismaClient } from "@safuney/db";
import type { InitiateResult, ParsedCallback, PaymentAdapter, RawCallback } from "@safuney/payments";
import { PaymentProviderError } from "@safuney/payments";
import { randomBytes } from "node:crypto";
import { quoteFee, zoneForCounty, type ZoneLike } from "@/lib/delivery";
import { nextOrderNumber } from "./numbers";
import { CreditService, CreditError } from "@/lib/credit/service";

export const RESERVATION_MINUTES = 30;
export const MAX_PAYMENT_ATTEMPTS = 5;

export interface ContactInput {
  name: string;
  email: string;
  phone: string; // E.164
  organisation?: string;
}

export type DeliveryInput =
  | { method: "PICKUP"; slot?: string }
  | { method: "DELIVERY"; county: string; town: string; line1?: string; landmark?: string; deliveryNotes?: string; slot?: string; recipientName?: string; recipientPhone?: string };

export interface PlaceOrderInput {
  cartToken: string;
  contact: ContactInput;
  delivery: DeliveryInput;
  paymentMethod: PaymentMethod;
  poNumber?: string;
  notes?: string;
  userId?: string;
  customerId?: string;
  memberRole?: string;
  /** Public base URL used for provider callbacks and return pages. */
  baseUrl: string;
}

export class OrderError extends Error {
  constructor(
    public readonly code: "EMPTY_CART" | "STOCK" | "UNAVAILABLE" | "NO_DELIVERY" | "METHOD_UNAVAILABLE" | "NOT_FOUND" | "ATTEMPTS" | "STATE" | "PROVIDER" | "CREDIT",
    message: string,
  ) {
    super(message);
  }
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  accessToken: string;
  totalMinorUnits: bigint;
  next: InitiateResult;
}

export type Registry = Record<PaymentMethod, PaymentAdapter>;

export class OrderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly adapters: Registry,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Delivery quote for the checkout UI. Pickup is always allowed; delivery needs an active zone. */
  async quoteDelivery(cartWeightGrams: number, subtotalMinorUnits: bigint, county: string | null): Promise<{ zones: ZoneLike[]; zone: ZoneLike | null; feeMinorUnits: bigint | null; free: boolean }> {
    const zones = (await this.prisma.deliveryZone.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })) as ZoneLike[];
    if (!county) return { zones, zone: null, feeMinorUnits: null, free: false };
    const zone = zoneForCounty(zones, county);
    if (!zone) return { zones, zone: null, feeMinorUnits: null, free: false };
    const q = quoteFee(zone, cartWeightGrams, subtotalMinorUnits);
    return { zones, zone, feeMinorUnits: q.ok ? q.feeMinorUnits : null, free: q.ok && q.free };
  }

  async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    const adapter = this.adapters[input.paymentMethod];
    if (!adapter.isConfigured()) throw new OrderError("METHOD_UNAVAILABLE", "That payment method is not available right now. Choose another.");
    if (input.paymentMethod === "INVOICE" && !input.customerId) {
      throw new OrderError("METHOD_UNAVAILABLE", "Invoice payment requires an approved organisation account. Log in or apply for credit.");
    }

    const placed = await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({ where: { token: input.cartToken, expiresAt: { gt: this.now() } }, include: { items: { orderBy: { createdAt: "asc" } } } });
      if (!cart || cart.items.length === 0) throw new OrderError("EMPTY_CART", "Your cart is empty.");

      // Lock the variants so two checkouts cannot both take the last pack.
      const ids = cart.items.map((i) => i.variantId);
      await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
      const variants = await tx.productVariant.findMany({ where: { id: { in: ids } }, include: { product: { select: { name: true, isActive: true, needsPoReview: true } } } });
      const byId = new Map(variants.map((v) => [v.id, v]));

      let subtotal = 0n;
      let vat = 0n;
      let weight = 0;
      const items: Prisma.OrderItemCreateManyOrderInput[] = [];
      for (const line of cart.items) {
        const v = byId.get(line.variantId);
        if (!v || !v.isActive || !v.product.isActive || v.product.needsPoReview) throw new OrderError("UNAVAILABLE", `${v?.product.name ?? "A product"} in your cart is no longer available. Remove it and try again.`);
        if (v.priceMinorUnits <= 0n) throw new OrderError("UNAVAILABLE", `${v.product.name} ${v.packLabel} has no price yet. Request a quote instead.`);
        const available = v.stockOnHand - v.stockReserved;
        if (!v.isMadeToOrder && line.qty > available) {
          throw new OrderError("STOCK", available > 0 ? `Only ${available} × ${v.product.name} ${v.packLabel} available. Reduce the quantity.` : `${v.product.name} ${v.packLabel} sold out while it was in your cart. Choose another pack, or ask us when it is back.`);
        }
        const lineExVat = money.times(v.priceMinorUnits, line.qty);
        const lineVat = money.vatOn(lineExVat, v.vatRateBps);
        subtotal += lineExVat;
        vat += lineVat;
        weight += (v.weightGrams ?? 0) * line.qty;
        items.push({ variantId: v.id, sku: v.sku, name: v.product.name, packLabel: v.packLabel, unitPriceMinorUnits: v.priceMinorUnits, qty: line.qty, vatRateBps: v.vatRateBps, lineTotalMinorUnits: lineExVat, lineVatMinorUnits: lineVat });
        // Reserve. The CHECK constraint (reserved <= on hand) protects made-to-order overflow too: for
        // made-to-order we only reserve what exists.
        const reserve = v.isMadeToOrder ? Math.min(line.qty, Math.max(0, available)) : line.qty;
        if (reserve > 0) {
          await tx.productVariant.update({ where: { id: v.id }, data: { stockReserved: { increment: reserve } } });
          await tx.inventoryMovement.create({ data: { variantId: v.id, type: "RESERVATION", qty: reserve, reason: "checkout", reference: cart.id } });
        }
      }

      // Delivery
      let deliveryFee = 0n;
      let deliveryZoneId: string | null = null;
      let shippingAddress: Prisma.InputJsonValue | undefined;
      if (input.delivery.method === "DELIVERY") {
        const zones = (await tx.deliveryZone.findMany({ where: { isActive: true } })) as ZoneLike[];
        const zone = zoneForCounty(zones, input.delivery.county);
        if (!zone) throw new OrderError("NO_DELIVERY", `We do not deliver to ${input.delivery.county} yet. Collect from Mombasa Road, Nairobi, or ask us for a courier quote.`);
        const q = quoteFee(zone, weight, subtotal);
        if (!q.ok) throw new OrderError("NO_DELIVERY", "We need to quote delivery for an order this size. Ask us and we will confirm the fee before you pay.");
        deliveryFee = q.feeMinorUnits;
        deliveryZoneId = zone.id;
        shippingAddress = { county: input.delivery.county, town: input.delivery.town, line1: input.delivery.line1 ?? null, landmark: input.delivery.landmark ?? null, deliveryNotes: input.delivery.deliveryNotes ?? null, recipientName: input.delivery.recipientName ?? input.contact.name, recipientPhone: input.delivery.recipientPhone ?? input.contact.phone, zone: zone.name };
      }

      const total = subtotal + vat + deliveryFee;

      // Determine initial status based on payment method and corporate credit / approval thresholds
      let initialStatus: OrderStatus = "PENDING_PAYMENT";
      if (input.paymentMethod === "COD") {
        initialStatus = "CONFIRMED";
      } else if (input.paymentMethod === "INVOICE") {
        const credit = new CreditService(tx as unknown as PrismaClient, this.now);
        try {
          const profile = await credit.assertCanPlaceInvoiceOrder(input.customerId!, total);
          if (credit.needsOrderApproval(profile, input.memberRole, total)) {
            initialStatus = "AWAITING_APPROVAL";
          } else {
            initialStatus = "CONFIRMED";
          }
        } catch (err) {
          if (err instanceof CreditError) {
            throw new OrderError("CREDIT", err.message);
          }
          throw err;
        }
      }

      const number = await nextOrderNumber(tx, this.now());
      const order = await tx.order.create({
        data: {
          number,
          customerId: input.customerId ?? null,
          userId: input.userId ?? null,
          guestEmail: input.contact.email,
          guestPhone: input.contact.phone,
          status: initialStatus,
          subtotalMinorUnits: subtotal,
          vatMinorUnits: vat,
          deliveryMinorUnits: deliveryFee,
          totalMinorUnits: total,
          paymentMethod: input.paymentMethod,
          deliveryMethod: input.delivery.method,
          deliveryZoneId,
          deliverySlot: input.delivery.slot ?? null,
          shippingAddress,
          billingAddress: { name: input.contact.name, email: input.contact.email, phone: input.contact.phone, organisation: input.contact.organisation ?? null },
          poNumber: input.poNumber ?? null,
          notes: input.notes ?? null,
          placedAt: this.now(),
          reservationExpiresAt: initialStatus === "PENDING_PAYMENT" ? new Date(this.now().getTime() + RESERVATION_MINUTES * 60_000) : null,
          items: { createMany: { data: items } },
          events: { create: { status: initialStatus, type: "order_placed", payload: { paymentMethod: input.paymentMethod, itemCount: items.length } } },
        },
      });
      // The cart has become an order.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order;
    });

    const next = await this.initiatePayment(placed.id, input.baseUrl);
    return { orderId: placed.id, orderNumber: placed.number, accessToken: placed.accessToken, totalMinorUnits: placed.totalMinorUnits, next };
  }

  /**
   * "Pay another way": switch an unpaid order to a different method and start collection with it.
   * Cash on delivery confirms the order immediately (the reservation is kept until dispatch).
   */
  async switchPaymentMethod(orderId: string, method: PaymentMethod, baseUrl: string): Promise<InitiateResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
    if (!order) throw new OrderError("NOT_FOUND", "Order not found.");
    if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_FAILED") throw new OrderError("STATE", `This order is ${order.status.toLowerCase().replace(/_/g, " ")}; its payment method can no longer be changed.`);
    const adapter = this.adapters[method];
    if (!adapter.isConfigured()) throw new OrderError("METHOD_UNAVAILABLE", "That payment method is not available right now. Choose another.");
    if (method === "INVOICE" && (!order.customer || order.customer.status !== "CREDIT_APPROVED" || order.customer.creditLimitMinorUnits <= 0n)) {
      throw new OrderError("METHOD_UNAVAILABLE", "Invoice payment is for approved credit accounts. Apply for an account or choose another method.");
    }
    if (method !== order.paymentMethod) {
      const nextStatus: OrderStatus = method === "COD" || method === "INVOICE" ? "CONFIRMED" : "PENDING_PAYMENT";
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: order.id }, data: { paymentMethod: method, status: nextStatus, reservationExpiresAt: nextStatus === "CONFIRMED" ? null : new Date(this.now().getTime() + RESERVATION_MINUTES * 60_000) } }),
        this.prisma.orderEvent.create({ data: { orderId: order.id, status: nextStatus, type: "payment_method_changed", payload: { from: order.paymentMethod, to: method } } }),
      ]);
    }
    return this.initiatePayment(order.id, baseUrl);
  }

  /** Start (or restart) collection for an order. Bounded attempts; each attempt is its own Payment row. */
  async initiatePayment(orderId: string, baseUrl: string): Promise<InitiateResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError("NOT_FOUND", "Order not found.");
    if (order.status === "AWAITING_APPROVAL") {
      return {
        kind: "offline",
        providerRequestId: `approval:${order.id}`,
        instructions: "Your order has been submitted and is currently awaiting internal finance sign-off from your organisation's approver.",
      };
    }
    if (order.paymentAttempts >= MAX_PAYMENT_ATTEMPTS) throw new OrderError("ATTEMPTS", "Too many payment attempts. Call us and we will take the payment by phone.");
    const adapter = this.adapters[order.paymentMethod];
    const attemptId = randomBytes(6).toString("hex");
    const billing = (order.billingAddress ?? {}) as { name?: string; email?: string; phone?: string };
    let result: InitiateResult;
    try {
      result = await adapter.initiate({
        orderId: order.id,
        orderNumber: order.number,
        amountMinorUnits: order.totalMinorUnits,
        currency: "KES",
        customer: { name: billing.name, email: order.guestEmail ?? billing.email, phone: order.guestPhone ?? billing.phone },
        returnUrl: `${baseUrl}/checkout/return?order=${order.number}&token=${order.accessToken}`,
        callbackBaseUrl: baseUrl,
        description: `Safuney ${order.number}`,
        attemptId,
      });
    } catch (e) {
      const msg = e instanceof PaymentProviderError ? e.message : "The payment provider did not respond.";
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: order.id }, data: { paymentAttempts: { increment: 1 } } }),
        this.prisma.orderEvent.create({ data: { orderId: order.id, status: order.status, type: "payment_initiation_failed", payload: { method: order.paymentMethod, message: msg } } }),
      ]);
      throw new OrderError("PROVIDER", `${msg} Nothing was charged. Try again, or choose another way to pay.`);
    }
    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: adapter.provider,
          providerRequestId: result.providerRequestId,
          amountMinorUnits: order.totalMinorUnits,
          status: result.kind === "offline" ? "PENDING" : "INITIATED",
          idempotencyKey: `init:${order.id}:${attemptId}`,
        },
      }),
      // A retry after a failed attempt is a fresh attempt: back to pending, with the reservation extended.
      this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentAttempts: { increment: 1 },
          ...(order.status === "PAYMENT_FAILED" && result.kind !== "offline" ? { status: "PENDING_PAYMENT", reservationExpiresAt: new Date(this.now().getTime() + RESERVATION_MINUTES * 60_000) } : {}),
        },
      }),
      this.prisma.orderEvent.create({ data: { orderId: order.id, status: order.status === "PAYMENT_FAILED" && result.kind !== "offline" ? "PENDING_PAYMENT" : order.status, type: "payment_initiated", payload: { method: order.paymentMethod, kind: result.kind, providerRequestId: result.providerRequestId } } }),
    ]);
    return result;
  }

  /**
   * Provider callback. Verified by the adapter, deduplicated by eventKey, amount-checked against the
   * order. Returns what happened so the route can answer the provider appropriately.
   */
  async handleCallback(method: PaymentMethod, raw: RawCallback): Promise<{ outcome: "APPLIED" | "DUPLICATE" | "REJECTED" | "IGNORED"; detail?: string; orderNumber?: string }> {
    const adapter = this.adapters[method];
    const parsed = await adapter.parseCallback(raw);
    if (!parsed.ok) {
      // Log the rejection (without trusting any of it) so forgery attempts are visible.
      await this.prisma.webhookEvent.create({ data: { provider: adapter.provider, eventKey: `rejected:${adapter.provider}:${randomBytes(8).toString("hex")}`, signatureOk: false, body: { reason: parsed.reason, detail: parsed.detail ?? null, ip: raw.ip ?? null }, error: parsed.reason } }).catch(() => undefined);
      return { outcome: "REJECTED", detail: parsed.reason };
    }
    return this.applyVerified(adapter, parsed);
  }

  private async applyVerified(adapter: PaymentAdapter, parsed: Extract<ParsedCallback, { ok: true }>): Promise<{ outcome: "APPLIED" | "DUPLICATE" | "IGNORED"; detail?: string; orderNumber?: string }> {
    // Idempotency: the unique eventKey makes a replay a no-op.
    try {
      await this.prisma.webhookEvent.create({ data: { provider: adapter.provider, eventKey: parsed.eventKey, signatureOk: true, body: parsed.raw as Prisma.InputJsonValue } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { outcome: "DUPLICATE" };
      throw e;
    }
    const payment = await this.prisma.payment.findUnique({ where: { providerRequestId: parsed.providerRequestId }, include: { order: { include: { items: true } } } });
    if (!payment) {
      await this.prisma.webhookEvent.update({ where: { eventKey: parsed.eventKey }, data: { error: "no matching payment", processedAt: this.now() } });
      return { outcome: "IGNORED", detail: "no matching payment" };
    }
    const order = payment.order;
    if (parsed.status === "PENDING") {
      await this.prisma.webhookEvent.update({ where: { eventKey: parsed.eventKey }, data: { processedAt: this.now() } });
      return { outcome: "IGNORED", detail: "pending", orderNumber: order.number };
    }
    if (parsed.status === "SUCCEEDED") {
      // Tamper check: a "successful" callback for the wrong amount never marks the order paid.
      if (parsed.amountMinorUnits !== undefined && !amountMatches(parsed.amountMinorUnits, payment.amountMinorUnits)) {
        await this.prisma.$transaction([
          this.prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: `Amount mismatch: paid ${parsed.amountMinorUnits}, expected ${payment.amountMinorUnits}`, rawCallback: parsed.raw as Prisma.InputJsonValue, providerRef: parsed.providerRef ?? null } }),
          this.prisma.orderEvent.create({ data: { orderId: order.id, status: order.status, type: "payment_amount_mismatch", payload: { paid: parsed.amountMinorUnits.toString(), expected: payment.amountMinorUnits.toString(), providerRef: parsed.providerRef ?? null } } }),
          this.prisma.webhookEvent.update({ where: { eventKey: parsed.eventKey }, data: { processedAt: this.now(), error: "amount mismatch" } }),
        ]);
        return { outcome: "IGNORED", detail: "amount mismatch", orderNumber: order.number };
      }
      if (payment.status === "SUCCEEDED" || order.status === "PAID") {
        await this.prisma.webhookEvent.update({ where: { eventKey: parsed.eventKey }, data: { processedAt: this.now() } });
        return { outcome: "DUPLICATE", orderNumber: order.number };
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", providerRef: parsed.providerRef ?? null, confirmedAt: this.now(), rawCallback: parsed.raw as Prisma.InputJsonValue } });
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID", reservationExpiresAt: null } });
        await tx.orderEvent.create({ data: { orderId: order.id, status: "PAID", type: "payment_received", payload: { provider: adapter.provider, providerRef: parsed.providerRef ?? null, payerRef: parsed.payerRef ?? null } } });
        // Decrement stock: reservation becomes an outbound movement.
        for (const item of order.items) {
          if (!item.variantId) continue;
          const v = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { stockReserved: true, stockOnHand: true } });
          if (!v) continue;
          const release = Math.min(item.qty, v.stockReserved);
          const out = Math.min(item.qty, v.stockOnHand);
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stockReserved: { decrement: release }, stockOnHand: { decrement: out } } });
          await tx.inventoryMovement.create({ data: { variantId: item.variantId, type: "OUT", qty: -out, reason: "order_paid", reference: order.number } });
        }
        await tx.webhookEvent.update({ where: { eventKey: parsed.eventKey }, data: { processedAt: this.now() } });
      });
      return { outcome: "APPLIED", orderNumber: order.number };
    }
    // FAILED / CANCELLED: record, release the reservation so stock is not held by a dead attempt.
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: parsed.status === "CANCELLED" ? "CANCELLED" : "FAILED", failureReason: parsed.failureReason ?? null, rawCallback: parsed.raw as Prisma.InputJsonValue } });
      if (order.status === "PENDING_PAYMENT") {
        await tx.order.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED" } });
        await tx.orderEvent.create({ data: { orderId: order.id, status: "PAYMENT_FAILED", type: parsed.status === "CANCELLED" ? "payment_cancelled" : "payment_failed", payload: { reason: parsed.failureReason ?? null } } });
      }
      await tx.webhookEvent.update({ where: { eventKey: parsed.eventKey }, data: { processedAt: this.now() } });
    });
    return { outcome: "APPLIED", orderNumber: order.number };
  }

  /** Poll: ask the provider when the last attempt is still open, and apply the answer the same way. */
  async refreshStatus(orderNumber: string, accessToken: string): Promise<{ status: OrderStatus; paymentStatus: string | null; message: string }> {
    const order = await this.prisma.order.findFirst({ where: { number: orderNumber, accessToken }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!order) throw new OrderError("NOT_FOUND", "Order not found.");
    const last = order.payments[0];
    if (last && (last.status === "INITIATED" || last.status === "PENDING") && last.providerRequestId && (order.paymentMethod === "MPESA" || order.paymentMethod === "CARD")) {
      const adapter = this.adapters[order.paymentMethod];
      try {
        const s = await adapter.queryStatus(last.providerRequestId);
        if (s.status !== "PENDING") {
          await this.applyVerified(adapter, { ok: true, eventKey: `query:${last.providerRequestId}:${s.status}:${s.providerRef ?? ""}`, providerRequestId: last.providerRequestId, providerRef: s.providerRef, amountMinorUnits: s.amountMinorUnits, status: s.status, failureReason: s.failureReason, raw: s.raw ?? { source: "query" } });
        }
      } catch {
        // Provider unreachable: leave as is; the customer sees "still waiting".
      }
    }
    const fresh = await this.prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
    return { status: fresh.status, paymentStatus: fresh.payments[0]?.status ?? null, message: statusMessage(fresh.status, fresh.paymentMethod) };
  }

  /** Release reservations of unpaid orders past their expiry (cron). */
  async releaseExpiredReservations(): Promise<number> {
    const expired = await this.prisma.order.findMany({ where: { status: { in: ["PENDING_PAYMENT", "PAYMENT_FAILED"] }, reservationExpiresAt: { lt: this.now() } }, include: { items: true } });
    for (const order of expired) {
      await this.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          if (!item.variantId) continue;
          const v = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { stockReserved: true } });
          const release = Math.min(item.qty, v?.stockReserved ?? 0);
          if (release > 0) {
            await tx.productVariant.update({ where: { id: item.variantId }, data: { stockReserved: { decrement: release } } });
            await tx.inventoryMovement.create({ data: { variantId: item.variantId, type: "RELEASE", qty: -release, reason: "reservation_expired", reference: order.number } });
          }
        }
        await tx.order.update({ where: { id: order.id }, data: { reservationExpiresAt: null } });
        await tx.orderEvent.create({ data: { orderId: order.id, status: order.status, type: "reservation_released", payload: { after: `${RESERVATION_MINUTES} min` } } });
      });
    }
    return expired.length;
  }

  /** Approve an order currently AWAITING_APPROVAL (corporate approver/owner only). */
  async approveOrder(orderId: string, approverUserId?: string): Promise<{ orderNumber: string; status: OrderStatus }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError("NOT_FOUND", "Order not found.");
    if (order.status !== "AWAITING_APPROVAL") {
      throw new OrderError("STATE", `Order cannot be approved because it is in status '${order.status}'.`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMED",
          approvedById: approverUserId ?? null,
          approvedAt: this.now(),
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId,
          status: "CONFIRMED",
          type: "order_approved",
          actorId: approverUserId ?? null,
          payload: { approvedBy: approverUserId ?? "approver" },
        },
      });
      return ord;
    });
    return { orderNumber: updated.number, status: updated.status };
  }

  /** Reject an order currently AWAITING_APPROVAL, releasing reserved stock. */
  async rejectOrder(orderId: string, approverUserId?: string, reason?: string): Promise<{ orderNumber: string; status: OrderStatus }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new OrderError("NOT_FOUND", "Order not found.");
    if (order.status !== "AWAITING_APPROVAL") {
      throw new OrderError("STATE", `Order cannot be rejected because it is in status '${order.status}'.`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      // Release reserved stock
      for (const item of order.items) {
        if (!item.variantId) continue;
        const v = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { stockReserved: true } });
        const release = Math.min(item.qty, v?.stockReserved ?? 0);
        if (release > 0) {
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stockReserved: { decrement: release } } });
          await tx.inventoryMovement.create({ data: { variantId: item.variantId, type: "RELEASE", qty: -release, reason: "order_rejected", reference: order.number } });
        }
      }
      const ord = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: this.now(),
          cancelReason: reason ?? "Rejected by organisation approver",
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId,
          status: "CANCELLED",
          type: "order_rejected",
          actorId: approverUserId ?? null,
          payload: { reason: reason ?? "Rejected by organisation approver" },
        },
      });
      return ord;
    });
    return { orderNumber: updated.number, status: updated.status };
  }
}

/** Daraja rounds to whole shillings; accept a difference below one shilling, never more. */
export function amountMatches(paid: bigint, expected: bigint): boolean {
  const diff = paid - expected;
  return diff >= -0n && diff < 100n ? diff >= 0n : paid === expected;
}

export function statusMessage(status: OrderStatus, method: PaymentMethod): string {
  switch (status) {
    case "AWAITING_APPROVAL":
      return "Order submitted and awaiting approval from your organisation's finance approver.";
    case "PENDING_PAYMENT":
      return method === "MPESA" ? "Waiting for the M-Pesa payment. Check your phone for the prompt and enter your PIN." : "Waiting for the card payment to be confirmed.";
    case "PAYMENT_FAILED":
      return "The payment was not completed. Nothing was charged. Send the request again, or choose another way to pay.";
    case "PAID":
      return "Payment received. We are preparing your order.";
    case "CONFIRMED":
      return method === "COD" ? "Order confirmed. Pay the rider when it arrives." : "Order confirmed. Your invoice is on its way.";
    case "PACKED":
      return "Your order is packed and waiting for the rider.";
    case "DISPATCHED":
      return "Your order is on its way.";
    case "DELIVERED":
      return "Delivered. Thank you.";
    case "CANCELLED":
      return "This order was cancelled.";
    case "REFUNDED":
      return "This order was refunded.";
    default:
      return "Order received.";
  }
}
