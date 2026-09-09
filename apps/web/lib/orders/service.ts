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
import { Prisma, type MemberRole, type OrderStatus, type PaymentMethod, type PrismaClient } from "@safuney/db";
import type { InitiateResult, ParsedCallback, PaymentAdapter, RawCallback } from "@safuney/payments";
import { PaymentProviderError } from "@safuney/payments";
import { randomBytes } from "node:crypto";
import { quoteFee, zoneForCounty, type ZoneLike } from "@/lib/delivery";
import { nextOrderNumber } from "./numbers";
import { APPROVAL_HOLD_DAYS, RESERVATION_MINUTES, releaseExpiredReservations, releaseItems } from "./reservations";
import { resolvePrices } from "@/lib/b2b/pricing";
import { assertCreditFor, CreditError } from "@/lib/b2b/credit";
import { issueTaxInvoice } from "@/lib/b2b/invoices";

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
  /** Role of the signed-in member in the organisation the order is for; buyers may need approval. */
  placedByRole?: MemberRole;
  /** An accepted quote: its unit prices are used instead of list or price-list prices (audited on the event). */
  quoteId?: string;
  /** Public base URL used for provider callbacks and return pages. */
  baseUrl: string;
}



export class OrderError extends Error {
  constructor(
    public readonly code: "EMPTY_CART" | "STOCK" | "UNAVAILABLE" | "NO_DELIVERY" | "METHOD_UNAVAILABLE" | "NOT_FOUND" | "ATTEMPTS" | "STATE" | "PROVIDER" | "CREDIT" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  accessToken: string;
  totalMinorUnits: bigint;
  next: InitiateResult;
}

export type Registry = Record<PaymentMethod, PaymentAdapter>;

export { APPROVAL_HOLD_DAYS, RESERVATION_MINUTES };

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
    if (input.paymentMethod === "INVOICE" && !input.customerId) throw new OrderError("METHOD_UNAVAILABLE", "Invoice payment is for approved credit accounts. Sign in to your organisation account or choose another method.");

    // Free anything held past its window on these packs before we read availability.
    const cartLines = await this.prisma.cartItem.findMany({ where: { cart: { token: input.cartToken } }, select: { variantId: true } });
    if (cartLines.length > 0) await releaseExpiredReservations(this.prisma, { variantIds: cartLines.map((l) => l.variantId), now: this.now() });

    const placed = await this.prisma.$transaction(async (tx) => {
      const customer = input.customerId ? await tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true, priceListId: true, approvalThresholdMinorUnits: true, priceList: { select: { isActive: true } } } }) : null;
      if (input.customerId && !customer) throw new OrderError("NOT_FOUND", "That organisation account no longer exists.");
      const cart = await tx.cart.findFirst({ where: { token: input.cartToken, expiresAt: { gt: this.now() } }, include: { items: { orderBy: { createdAt: "asc" } } } });
      if (!cart || cart.items.length === 0) throw new OrderError("EMPTY_CART", "Your cart is empty.");

      // Lock the variants so two checkouts cannot both take the last pack.
      // Sorted so this and releaseItems take variant locks in the same order and cannot deadlock.
      const ids = cart.items.map((i) => i.variantId).sort();
      await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
      const variants = await tx.productVariant.findMany({ where: { id: { in: ids } }, include: { product: { select: { name: true, isActive: true, needsPoReview: true } } } });
      const byId = new Map(variants.map((v) => [v.id, v]));
      // Customer-specific prices (price list tiers) or list prices; the server decides either way.
      const prices = await resolvePrices(
        tx,
        customer?.priceList?.isActive ? customer.priceListId : null,
        cart.items.map((i) => ({ variantId: i.variantId, qty: i.qty, listPriceMinorUnits: byId.get(i.variantId)?.priceMinorUnits ?? 0n })),
      );
      // An accepted quote overrides both: the quoted unit prices are the agreed ones.
      if (input.quoteId) {
        const quote = await tx.quote.findUnique({ where: { id: input.quoteId }, include: { items: true } });
        if (!quote || quote.status !== "ACCEPTED") throw new OrderError("STATE", "That quote is no longer open.");
        for (const qi of quote.items) if (qi.variantId && qi.unitPriceMinorUnits !== null) prices.set(qi.variantId, qi.unitPriceMinorUnits);
      }

      let subtotal = 0n;
      let vat = 0n;
      let weight = 0;
      const items: Prisma.OrderItemCreateManyOrderInput[] = [];
      // What each line actually took off the shelf; a made-to-order line can reserve less than it ordered.
      const reservedByVariant = new Map<string, number>();
      for (const line of cart.items) {
        const v = byId.get(line.variantId);
        if (!v || !v.isActive || !v.product.isActive || v.product.needsPoReview) throw new OrderError("UNAVAILABLE", `${v?.product.name ?? "A product"} in your cart is no longer available. Remove it and try again.`);
        const unitPrice = prices.get(v.id) ?? v.priceMinorUnits;
        if (unitPrice <= 0n) throw new OrderError("UNAVAILABLE", `${v.product.name} ${v.packLabel} has no price yet. Request a quote instead.`);
        const available = v.stockOnHand - v.stockReserved;
        if (!v.isMadeToOrder && line.qty > available) {
          throw new OrderError("STOCK", available > 0 ? `Only ${available} × ${v.product.name} ${v.packLabel} available. Reduce the quantity.` : `${v.product.name} ${v.packLabel} sold out while it was in your cart. Choose another pack, or ask us when it is back.`);
        }
        const lineExVat = money.times(unitPrice, line.qty);
        const lineVat = money.vatOn(lineExVat, v.vatRateBps);
        subtotal += lineExVat;
        vat += lineVat;
        weight += (v.weightGrams ?? 0) * line.qty;
        items.push({ variantId: v.id, sku: v.sku, name: v.product.name, packLabel: v.packLabel, unitPriceMinorUnits: unitPrice, qty: line.qty, vatRateBps: v.vatRateBps, lineTotalMinorUnits: lineExVat, lineVatMinorUnits: lineVat });
        // Reserve. The CHECK constraint (reserved <= on hand) protects made-to-order overflow too: for
        // made-to-order we only reserve what exists.
        const reserve = v.isMadeToOrder ? Math.min(line.qty, Math.max(0, available)) : line.qty;
        reservedByVariant.set(v.id, reserve);
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

      for (const item of items) if (item.variantId) item.reservedQty = reservedByVariant.get(item.variantId) ?? 0;

      const total = subtotal + vat + deliveryFee;
      const number = await nextOrderNumber(tx, this.now());
      // Approval: a buyer's order at or above the organisation's threshold waits for an approver.
      const needsApproval = Boolean(customer && customer.approvalThresholdMinorUnits !== null && total >= customer.approvalThresholdMinorUnits && input.placedByRole === "BUYER");
      const initialStatus: OrderStatus = needsApproval ? "AWAITING_APPROVAL" : input.paymentMethod === "COD" || input.paymentMethod === "INVOICE" ? "CONFIRMED" : "PENDING_PAYMENT";
      // Credit is checked when the invoice order is confirmed (now, or at approval), with the customer row locked.
      if (input.paymentMethod === "INVOICE" && !needsApproval) {
        try {
          await assertCreditFor(tx, customer!.id, total, this.now());
        } catch (e) {
          if (e instanceof CreditError) throw new OrderError(e.code === "NOT_APPROVED" ? "METHOD_UNAVAILABLE" : "CREDIT", e.message);
          throw e;
        }
      }
      const reservationExpiresAt = initialStatus === "PENDING_PAYMENT" ? new Date(this.now().getTime() + RESERVATION_MINUTES * 60_000) : initialStatus === "AWAITING_APPROVAL" ? new Date(this.now().getTime() + APPROVAL_HOLD_DAYS * 86_400_000) : null;
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
          reservationExpiresAt,
          items: { createMany: { data: items } },
          events: { create: { status: initialStatus, type: "order_placed", actorId: input.userId ?? null, payload: { paymentMethod: input.paymentMethod, itemCount: items.length, priceListId: customer?.priceListId ?? null, quoteId: input.quoteId ?? null, needsApproval } } },
        },
      });
      if (initialStatus === "CONFIRMED" && input.paymentMethod === "INVOICE") await issueTaxInvoice(tx, order.id, this.now());
      // The cart has become an order.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order;
    });

    if (placed.status === "AWAITING_APPROVAL") {
      return { orderId: placed.id, orderNumber: placed.number, accessToken: placed.accessToken, totalMinorUnits: placed.totalMinorUnits, status: placed.status, next: { kind: "offline", providerRequestId: `approval:${placed.id}`, instructions: "Waiting for an approver in your organisation." } };
    }
    const next = await this.initiatePayment(placed.id, input.baseUrl);
    return { orderId: placed.id, orderNumber: placed.number, accessToken: placed.accessToken, totalMinorUnits: placed.totalMinorUnits, status: placed.status, next };
  }

  /** Who may approve: an OWNER or APPROVER member of the organisation the order belongs to. */
  private async assertApprover(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new OrderError("NOT_FOUND", "Order not found.");
    if (!order.customerId) throw new OrderError("FORBIDDEN", "This order does not belong to an organisation.");
    const member = await this.prisma.customerMember.findUnique({ where: { customerId_userId: { customerId: order.customerId, userId } } });
    if (!member || member.role === "BUYER") throw new OrderError("FORBIDDEN", "Only an approver or owner of the organisation can decide this order.");
    if (order.status !== "AWAITING_APPROVAL") throw new OrderError("STATE", `This order is ${order.status.toLowerCase().replace(/_/g, " ")} and no longer needs approval.`);
    return order;
  }

  /**
   * Approval: the order proceeds as if just placed. Invoice orders are confirmed against credit
   * (checked now, with the customer row locked) and invoiced; cash on delivery is confirmed;
   * M-Pesa and card go to pending payment and collection starts.
   */
  async approveOrder(orderId: string, approverUserId: string, baseUrl: string): Promise<{ status: OrderStatus; next: InitiateResult }> {
    const order = await this.assertApprover(orderId, approverUserId);
    const nextStatus: OrderStatus = order.paymentMethod === "COD" || order.paymentMethod === "INVOICE" ? "CONFIRMED" : "PENDING_PAYMENT";
    await this.prisma.$transaction(async (tx) => {
      // Claim the decision inside the transaction: two approvers pressing at once must not both pass
      // the state check they made outside it.
      const claim = await tx.order.updateMany({ where: { id: order.id, status: "AWAITING_APPROVAL" }, data: { status: nextStatus } });
      if (claim.count !== 1) throw new OrderError("STATE", "Someone else decided this order a moment ago.");
      if (order.paymentMethod === "INVOICE") {
        try {
          await assertCreditFor(tx, order.customerId!, order.totalMinorUnits, this.now());
        } catch (e) {
          if (e instanceof CreditError) throw new OrderError(e.code === "NOT_APPROVED" ? "METHOD_UNAVAILABLE" : "CREDIT", e.message);
          throw e;
        }
      }
      await tx.order.update({ where: { id: order.id }, data: { approvedById: approverUserId, approvedAt: this.now(), reservationExpiresAt: nextStatus === "PENDING_PAYMENT" ? new Date(this.now().getTime() + RESERVATION_MINUTES * 60_000) : null } });
      await tx.orderEvent.create({ data: { orderId: order.id, status: nextStatus, type: "order_approved", actorId: approverUserId, payload: { paymentMethod: order.paymentMethod } } });
      if (nextStatus === "CONFIRMED" && order.paymentMethod === "INVOICE") await issueTaxInvoice(tx, order.id, this.now());
    });
    const next = await this.initiatePayment(order.id, baseUrl);
    return { status: nextStatus, next };
  }

  /** Rejection cancels the order and releases its stock; the reason is on the event for the buyer. */
  async rejectOrder(orderId: string, approverUserId: string, reason: string): Promise<void> {
    const order = await this.assertApprover(orderId, approverUserId);
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({ where: { id: order.id, status: "AWAITING_APPROVAL" }, data: { status: "CANCELLED", reservationExpiresAt: null } });
      if (claim.count !== 1) throw new OrderError("STATE", "Someone else decided this order a moment ago.");
      await releaseItems(tx, order.items, order.number, "approval_rejected");
      await tx.orderItem.updateMany({ where: { orderId: order.id }, data: { reservedQty: 0 } });
      await tx.orderEvent.create({ data: { orderId: order.id, status: "CANCELLED", type: "order_rejected", actorId: approverUserId, payload: { reason } } });
    });
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
    if (method === "INVOICE" && !order.customerId) throw new OrderError("METHOD_UNAVAILABLE", "Invoice payment is for approved credit accounts. Apply for an account or choose another method.");
    if (method !== order.paymentMethod) {
      const nextStatus: OrderStatus = method === "COD" || method === "INVOICE" ? "CONFIRMED" : "PENDING_PAYMENT";
      await this.prisma.$transaction(async (tx) => {
        if (method === "INVOICE") {
          try {
            await assertCreditFor(tx, order.customerId!, order.totalMinorUnits, this.now());
          } catch (e) {
            if (e instanceof CreditError) throw new OrderError(e.code === "NOT_APPROVED" ? "METHOD_UNAVAILABLE" : "CREDIT", e.message);
            throw e;
          }
        }
        await tx.order.update({ where: { id: order.id }, data: { paymentMethod: method, status: nextStatus, reservationExpiresAt: nextStatus === "CONFIRMED" ? null : new Date(this.now().getTime() + RESERVATION_MINUTES * 60_000) } });
        await tx.orderEvent.create({ data: { orderId: order.id, status: nextStatus, type: "payment_method_changed", payload: { from: order.paymentMethod, to: method } } });
        if (method === "INVOICE") await issueTaxInvoice(tx, order.id, this.now());
      });
    }
    return this.initiatePayment(order.id, baseUrl);
  }

  /** Start (or restart) collection for an order. Bounded attempts; each attempt is its own Payment row. */
  async initiatePayment(orderId: string, baseUrl: string): Promise<InitiateResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError("NOT_FOUND", "Order not found.");
    if (order.status === "PAID" || order.status === "CANCELLED" || order.status === "REFUNDED") throw new OrderError("STATE", `This order is ${order.status.toLowerCase()} and cannot be paid again.`);
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
        // The reservation becomes an outbound movement. Sorted by variant so this takes locks in the
        // same order as placeOrder and the expiry sweep; releases only what this order actually held.
        const paidLines = order.items.filter((i): i is typeof i & { variantId: string } => Boolean(i.variantId)).sort((a, b) => a.variantId.localeCompare(b.variantId));
        const short: Array<{ sku: string; ordered: number; taken: number }> = [];
        for (const item of paidLines) {
          const v = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { stockReserved: true, stockOnHand: true } });
          if (!v) continue;
          const release = Math.min(item.reservedQty, v.stockReserved);
          // Clamped so stock can never go negative (non-negotiable #3). The clamp can bite when an
          // order's 30-minute hold expired and someone else bought the packs before this payment
          // landed: the customer has paid for more than we can ship.
          const out = Math.min(item.qty, v.stockOnHand);
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stockReserved: { decrement: release }, stockOnHand: { decrement: out } } });
          await tx.inventoryMovement.create({ data: { variantId: item.variantId, type: "OUT", qty: -out, reason: "order_paid", reference: order.number } });
          if (out < item.qty) short.push({ sku: item.sku, ordered: item.qty, taken: out });
        }
        // Say so, rather than letting the warehouse find out at the pick face. The order stays PAID —
        // the money did arrive — but somebody has to decide whether to part-ship, back-order or refund,
        // and they can only do that if they are told.
        if (short.length > 0) {
          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              status: "PAID",
              type: "stock_shortfall",
              payload: { lines: short.map((l) => ({ sku: l.sku, ordered: l.ordered, taken: l.taken, short: l.ordered - l.taken })) },
            },
          });
        }
        // The hold is spent; nothing may release it again.
        await tx.orderItem.updateMany({ where: { orderId: order.id }, data: { reservedQty: 0 } });
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

  // ───────────────────────────── Warehouse (Phase 5) ─────────────────────────────

  private async assertWarehouse(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
    if (!u || !u.isActive || !["WAREHOUSE", "ADMIN"].includes(u.role)) throw new OrderError("FORBIDDEN", "Only warehouse staff can change fulfilment.");
  }

  private async fulfilmentOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { variant: { select: { sku: true, stockOnHand: true, stockReserved: true, product: { select: { name: true } } } } } }, fulfilment: true } });
    if (!order) throw new OrderError("NOT_FOUND", "Order not found.");
    return order;
  }

  /** Orders the warehouse works on: paid or confirmed and not yet dispatched, oldest first. */
  async warehouseQueue(userId: string) {
    await this.assertWarehouse(userId);
    return this.prisma.order.findMany({ where: { status: { in: ["PAID", "CONFIRMED", "PACKED", "DISPATCHED"] } }, orderBy: [{ status: "asc" }, { placedAt: "asc" }], include: { items: true, fulfilment: true, customer: { select: { displayName: true } } } });
  }

  /** The pick list is snapshotted on first view so it does not change under the picker. */
  async pickList(orderId: string, userId: string) {
    await this.assertWarehouse(userId);
    const order = await this.fulfilmentOrder(orderId);
    if (order.fulfilment?.pickListJson) return { order, lines: order.fulfilment.pickListJson as Array<{ sku: string; name: string; packLabel: string; qty: number }> };
    const lines = order.items.map((i) => ({ sku: i.sku, name: i.name, packLabel: i.packLabel, qty: i.qty }));
    await this.prisma.fulfilment.upsert({ where: { orderId }, create: { orderId, pickListJson: lines }, update: { pickListJson: lines } });
    return { order, lines };
  }

  async markPacked(orderId: string, userId: string): Promise<void> {
    await this.assertWarehouse(userId);
    const order = await this.fulfilmentOrder(orderId);
    if (order.status !== "PAID" && order.status !== "CONFIRMED") throw new OrderError("STATE", `Order ${order.number} is ${order.status.toLowerCase().replace(/_/g, " ")} and cannot be packed.`);
    await this.prisma.$transaction([
      this.prisma.fulfilment.upsert({ where: { orderId }, create: { orderId, packedAt: this.now(), packedById: userId }, update: { packedAt: this.now(), packedById: userId } }),
      this.prisma.order.update({ where: { id: orderId }, data: { status: "PACKED" } }),
      this.prisma.orderEvent.create({ data: { orderId, status: "PACKED", type: "order_packed", actorId: userId, payload: {} } }),
    ]);
  }

  /**
   * Dispatch moves stock from reserved to out, exactly once (guarded by the status transition), and
   * records who is carrying it.
   */
  async dispatch(orderId: string, userId: string, rider: { name: string; phone: string }): Promise<void> {
    await this.assertWarehouse(userId);
    const order = await this.fulfilmentOrder(orderId);
    if (order.status !== "PACKED") throw new OrderError("STATE", `Order ${order.number} must be packed before it is dispatched.`);
    if (rider.name.trim().length < 2) throw new OrderError("STATE", "Who is delivering it? Enter the rider's name.");
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.order.updateMany({ where: { id: orderId, status: "PACKED" }, data: { status: "DISPATCHED" } });
      if (locked.count !== 1) throw new OrderError("STATE", "This order was dispatched by someone else a moment ago.");
      // M-Pesa and card orders left stock at payment (see applyVerified); cash and invoice orders are only
      // reserved until now. The order's method decides, never the variant's counters, which belong to every order.
      const movesStockNow = order.paymentMethod === "COD" || order.paymentMethod === "INVOICE";
      if (movesStockNow) {
        // Sorted by variant, like placement, payment and the expiry sweep, so none of them deadlock.
        const lines = order.items.filter((i): i is typeof i & { variantId: string } => Boolean(i.variantId)).sort((a, b) => a.variantId.localeCompare(b.variantId));
        for (const item of lines) {
          const v = await tx.productVariant.findUniqueOrThrow({ where: { id: item.variantId }, select: { stockOnHand: true, stockReserved: true } });
          // Release only what this order actually held; a made-to-order line reserved less than it ordered.
          const release = Math.min(item.reservedQty, v.stockReserved);
          const out = Math.min(item.qty, v.stockOnHand);
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stockReserved: { decrement: release }, stockOnHand: { decrement: out } } });
          await tx.inventoryMovement.create({ data: { variantId: item.variantId, type: "OUT", qty: -out, reason: "dispatched", reference: order.number } });
        }
        await tx.orderItem.updateMany({ where: { orderId: order.id }, data: { reservedQty: 0 } });
      }
      await tx.fulfilment.upsert({ where: { orderId }, create: { orderId, dispatchedAt: this.now(), riderName: rider.name.trim(), riderPhone: rider.phone.trim() || null }, update: { dispatchedAt: this.now(), riderName: rider.name.trim(), riderPhone: rider.phone.trim() || null } });
      await tx.orderEvent.create({ data: { orderId, status: "DISPATCHED", type: "order_dispatched", actorId: userId, payload: { rider: rider.name.trim(), riderPhone: rider.phone.trim() || null } } });
    });
  }

  async markDelivered(orderId: string, userId: string, pod: { name: string; photoUrl?: string | null }): Promise<void> {
    await this.assertWarehouse(userId);
    const order = await this.fulfilmentOrder(orderId);
    if (order.status !== "DISPATCHED") throw new OrderError("STATE", `Order ${order.number} is not out for delivery.`);
    if (pod.name.trim().length < 2) throw new OrderError("STATE", "Who signed for it? Enter the receiver's name.");
    await this.prisma.$transaction([
      this.prisma.fulfilment.update({ where: { orderId }, data: { deliveredAt: this.now(), podName: pod.name.trim(), podPhotoUrl: pod.photoUrl ?? null } }),
      this.prisma.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } }),
      this.prisma.orderEvent.create({ data: { orderId, status: "DELIVERED", type: "order_delivered", actorId: userId, payload: { receivedBy: pod.name.trim(), photo: Boolean(pod.photoUrl) } } }),
    ]);
  }

  /** Cash or M-Pesa collected by the rider on a COD order: recorded as a payment, with the M-Pesa reference. */
  async recordCodCollection(orderId: string, userId: string, input: { amountMinorUnits: bigint; mpesaRef?: string | null }): Promise<void> {
    await this.assertWarehouse(userId);
    const order = await this.fulfilmentOrder(orderId);
    if (order.paymentMethod !== "COD") throw new OrderError("STATE", "This order is not cash on delivery.");
    if (order.status !== "DISPATCHED" && order.status !== "DELIVERED") throw new OrderError("STATE", "Record the collection once the order is out for delivery or delivered.");
    if (input.amountMinorUnits <= 0n) throw new OrderError("STATE", "Enter the amount collected.");
    if (!amountMatches(input.amountMinorUnits, order.totalMinorUnits)) throw new OrderError("STATE", `The order total is ${money.formatKes(order.totalMinorUnits)}; ${money.formatKes(input.amountMinorUnits)} does not match. Call the office if the customer paid a different amount.`);
    const existing = await this.prisma.payment.findFirst({ where: { orderId, provider: "COD", status: "SUCCEEDED" } });
    if (existing) throw new OrderError("STATE", "Collection is already recorded for this order.");
    await this.prisma.$transaction([
      this.prisma.payment.create({ data: { orderId, provider: "COD", providerRef: input.mpesaRef?.trim() || null, amountMinorUnits: input.amountMinorUnits, status: "SUCCEEDED", idempotencyKey: `cod:${orderId}`, rawCallback: { recordedBy: userId } } }),
      this.prisma.fulfilment.upsert({ where: { orderId }, create: { orderId, codCollectedMinorUnits: input.amountMinorUnits, codMpesaRef: input.mpesaRef?.trim() || null }, update: { codCollectedMinorUnits: input.amountMinorUnits, codMpesaRef: input.mpesaRef?.trim() || null } }),
      this.prisma.orderEvent.create({ data: { orderId, status: order.status, type: "cod_collected", actorId: userId, payload: { amountMinorUnits: input.amountMinorUnits.toString(), mpesaRef: input.mpesaRef?.trim() || null } } }),
    ]);
  }

  /** Release reservations of unpaid orders past their expiry (cron). */
  /** Daily cron sweep. Availability checks release lazily too, so stock is never held past its window. */
  async releaseExpiredReservations(): Promise<number> {
    return releaseExpiredReservations(this.prisma, { now: this.now() });
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
      return "Waiting for an approver in your organisation. Nothing is charged until it is approved.";
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
