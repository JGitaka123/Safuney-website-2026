/** Integration tests for order placement and payment callbacks (non-negotiables #1, #3, #4, #5). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { MockAdapter, createRegistry } from "@safuney/payments";
import { CartService } from "@/lib/cart/service";
import { OrderService, amountMatches } from "@/lib/orders/service";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("order service", () => {
  let prisma: PrismaClient;
  let carts: CartService;
  let orders: OrderService;
  const stamp = Date.now().toString(36);
  let vA: string; // 5 L, stock 3, KES 1,250 ex VAT
  let vB: string; // 20 L, made to order

  const contact = { name: "Test Buyer", email: `buyer-${stamp}@example.test`, phone: "+254712345678" };
  const base = "https://preview.example.test";

  beforeAll(async () => {
    prisma = createTestClient(url!);
    const registry = createRegistry({ PAYMENTS_MODE: "mock" });
    carts = new CartService(prisma);
    orders = new OrderService(prisma, registry);
    const cat = await prisma.category.create({ data: { slug: `ord-cat-${stamp}`, name: "Order test" } });
    const p = await prisma.product.create({ data: { slug: `ord-p-${stamp}`, name: "Order test formulation", shortDescription: "x", categoryId: cat.id, isActive: true, needsPoReview: false } });
    vA = (await prisma.productVariant.create({ data: { productId: p.id, sku: `OA-${stamp}`, packSizeValue: "5", unit: "L", packLabel: "5 L", priceMinorUnits: 125000n, vatRateBps: 1600, stockOnHand: 3, weightGrams: 5200 } })).id;
    vB = (await prisma.productVariant.create({ data: { productId: p.id, sku: `OB-${stamp}`, packSizeValue: "20", unit: "L", packLabel: "20 L", priceMinorUnits: 400000n, vatRateBps: 1600, stockOnHand: 0, isMadeToOrder: true, weightGrams: 21000 } })).id;
    await prisma.deliveryZone.upsert({
      where: { slug: `ord-zone-${stamp}` },
      create: { slug: `ord-zone-${stamp}`, name: "Test zone", counties: [`Testcounty${stamp}`], feeRules: [{ maxWeightGrams: 10000, feeMinorUnits: "30000" }, { feeMinorUnits: "60000" }], freeAboveMinorUnits: 10000000n, isActive: true, slots: ["Morning"] },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.order.deleteMany({ where: { guestEmail: contact.email } });
    });
    await prisma.webhookEvent.deleteMany({ where: { eventKey: { contains: stamp } } });
    await prisma.deliveryZone.deleteMany({ where: { slug: `ord-zone-${stamp}` } });
    await prisma.product.deleteMany({ where: { slug: `ord-p-${stamp}` } });
    await prisma.category.deleteMany({ where: { slug: `ord-cat-${stamp}` } });
    await prisma.$disconnect();
  });

  async function cartWith(lines: Array<[string, number]>) {
    const c = await carts.getOrCreate(undefined);
    for (const [v, q] of lines) await carts.add(c.token, v, q);
    return c.token;
  }

  it("recomputes totals from the catalogue, applies the delivery fee, reserves stock and appends events", async () => {
    const token = await cartWith([[vA, 2]]);
    const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "DELIVERY", county: `Testcounty${stamp}`, town: "Town" }, paymentMethod: "MPESA", baseUrl: base });
    expect(r.orderNumber).toMatch(/^SFN-\d{8}-\d{4}$/);
    expect(r.totalMinorUnits).toBe(250000n + 40000n + 60000n); // 2 × 1,250 + VAT + fee for 10.4 kg (second rule)
    expect(r.next.kind).toBe("prompt");
    const order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber }, include: { items: true, events: { orderBy: { createdAt: "asc" } }, payments: true } });
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.items[0]).toMatchObject({ sku: `OA-${stamp}`, qty: 2, unitPriceMinorUnits: 125000n, lineVatMinorUnits: 40000n });
    expect(order.events.map((e) => e.type)).toEqual(["order_placed", "payment_initiated"]);
    expect(order.payments[0]?.status).toBe("INITIATED");
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: vA } });
    expect(v.stockReserved).toBe(2);
    // The cart was consumed.
    expect((await carts.find(token))?.lines).toEqual([]);
  });

  it("refuses to oversell: the second checkout for the last packs fails and reserves nothing", async () => {
    const token = await cartWith([[vA, 1]]);
    // Only 1 left (3 on hand, 2 reserved). Try to take 2 by editing the cart after the stock check.
    await prisma.cartItem.updateMany({ where: { cart: { token } }, data: { qty: 2 } });
    await expect(orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base })).rejects.toMatchObject({ code: "STOCK" });
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: vA } });
    expect(v.stockReserved).toBe(2);
  });

  it("a paid callback marks the order paid once, decrements stock, and a replay is a no-op", async () => {
    const token = await cartWith([[vA, 1]]);
    const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "MPESA", baseUrl: base });
    const payment = await prisma.payment.findFirstOrThrow({ where: { order: { number: r.orderNumber } } });
    const body = JSON.stringify({ providerRequestId: payment.providerRequestId, status: "SUCCEEDED", amountMinorUnits: r.totalMinorUnits.toString(), ref: `RCPT${stamp}` });
    const first = await orders.handleCallback("MPESA", { body, headers: { "x-mock-signature": MockAdapter.sign(body) } });
    expect(first.outcome).toBe("APPLIED");
    const replay = await orders.handleCallback("MPESA", { body, headers: { "x-mock-signature": MockAdapter.sign(body) } });
    expect(replay.outcome).toBe("DUPLICATE");
    const order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber }, include: { events: true, payments: true } });
    expect(order.status).toBe("PAID");
    expect(order.payments[0]).toMatchObject({ status: "SUCCEEDED", providerRef: `RCPT${stamp}` });
    expect(order.events.filter((e) => e.type === "payment_received")).toHaveLength(1);
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: vA } });
    expect(v.stockOnHand).toBe(2); // 3 - 1 sold
    expect(v.stockReserved).toBe(2); // the first test's reservation is still held; this one was consumed
  });

  it("a forged or tampered callback never marks an order paid", async () => {
    const token = await cartWith([[vB, 1]]);
    const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "MPESA", baseUrl: base });
    const payment = await prisma.payment.findFirstOrThrow({ where: { order: { number: r.orderNumber } } });
    const body = JSON.stringify({ providerRequestId: payment.providerRequestId, status: "SUCCEEDED", amountMinorUnits: r.totalMinorUnits.toString() });
    // Bad signature.
    expect((await orders.handleCallback("MPESA", { body, headers: { "x-mock-signature": "nope" } })).outcome).toBe("REJECTED");
    // Right signature, wrong amount (paid 1 cent).
    const cheap = JSON.stringify({ providerRequestId: payment.providerRequestId, status: "SUCCEEDED", amountMinorUnits: "1", ref: `LOW${stamp}` });
    expect((await orders.handleCallback("MPESA", { body: cheap, headers: { "x-mock-signature": MockAdapter.sign(cheap) } })).outcome).toBe("IGNORED");
    const order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber }, include: { events: true } });
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.events.some((e) => e.type === "payment_amount_mismatch")).toBe(true);
    // Unknown providerRequestId.
    const unknown = JSON.stringify({ providerRequestId: "mock-nothing", status: "SUCCEEDED", amountMinorUnits: "1" });
    expect((await orders.handleCallback("MPESA", { body: unknown, headers: { "x-mock-signature": MockAdapter.sign(unknown) } })).outcome).toBe("IGNORED");
  });

  it("a cancelled prompt moves the order to payment failed and a retry re-initiates within the attempt cap", async () => {
    const token = await cartWith([[vB, 2]]);
    const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "MPESA", baseUrl: base });
    const payment = await prisma.payment.findFirstOrThrow({ where: { order: { number: r.orderNumber } } });
    const body = JSON.stringify({ providerRequestId: payment.providerRequestId, status: "CANCELLED" });
    await orders.handleCallback("MPESA", { body, headers: { "x-mock-signature": MockAdapter.sign(body) } });
    let order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber } });
    expect(order.status).toBe("PAYMENT_FAILED");
    const again = await orders.initiatePayment(order.id, base);
    expect(again.kind).toBe("prompt");
    order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber } });
    expect(order.paymentAttempts).toBe(2);
    // The retry is a fresh attempt: the order is pending again (the pending page must not show the old failure).
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.reservationExpiresAt && order.reservationExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect((await orders.refreshStatus(r.orderNumber, order.accessToken)).status).toBe("PENDING_PAYMENT");
    for (let i = 0; i < 3; i++) await orders.initiatePayment(order.id, base);
    await expect(orders.initiatePayment(order.id, base)).rejects.toMatchObject({ code: "ATTEMPTS" });
  });

  it("cash on delivery confirms immediately and invoice is refused for guests", async () => {
    const token = await cartWith([[vB, 1]]);
    const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base });
    expect(r.next.kind).toBe("offline");
    const order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber } });
    expect(order.status).toBe("CONFIRMED");
    const token2 = await cartWith([[vB, 1]]);
    await expect(orders.placeOrder({ cartToken: token2, contact, delivery: { method: "PICKUP" }, paymentMethod: "INVOICE", baseUrl: base })).rejects.toMatchObject({ code: "METHOD_UNAVAILABLE" });
  });

  it("refuses delivery outside the zones with a recoverable message", async () => {
    // A catch-all zone (no counties) serves everywhere; switch any off for this check and restore after.
    const catchAll = await prisma.deliveryZone.findMany({ where: { isActive: true, counties: { isEmpty: true } }, select: { id: true } });
    await prisma.deliveryZone.updateMany({ where: { id: { in: catchAll.map((z) => z.id) } }, data: { isActive: false } });
    try {
      const token = await cartWith([[vB, 1]]);
      await expect(orders.placeOrder({ cartToken: token, contact, delivery: { method: "DELIVERY", county: "Nowhere", town: "x" }, paymentMethod: "COD", baseUrl: base })).rejects.toMatchObject({ code: "NO_DELIVERY" });
    } finally {
      await prisma.deliveryZone.updateMany({ where: { id: { in: catchAll.map((z) => z.id) } }, data: { isActive: true } });
    }
  });

  it("releases expired reservations", async () => {
    const before = (await prisma.productVariant.findUniqueOrThrow({ where: { id: vA } })).stockReserved;
    await prisma.order.updateMany({ where: { guestEmail: contact.email, status: "PENDING_PAYMENT" }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    const n = await orders.releaseExpiredReservations();
    expect(n).toBeGreaterThan(0);
    const after = (await prisma.productVariant.findUniqueOrThrow({ where: { id: vA } })).stockReserved;
    expect(after).toBeLessThan(before);
  });

  it("tolerates Daraja's whole-shilling rounding but nothing more", () => {
    expect(amountMatches(145100n, 145050n)).toBe(true);
    expect(amountMatches(145050n, 145050n)).toBe(true);
    expect(amountMatches(145000n, 145050n)).toBe(false);
    expect(amountMatches(200000n, 145050n)).toBe(false);
  });
});
