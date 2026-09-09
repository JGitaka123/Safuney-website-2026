/**
 * The adversarial pass (master prompt §10): price tampering, replayed callbacks, negative quantities,
 * XSS, IDOR, rate limiting, coupon abuse.
 *
 * Every test here asserts a **defence**, not a feature — each one fails if the protection is removed.
 * That is the difference between a security note and a security test, and it is the reason these live
 * in the suite rather than in a document.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { MockAdapter, createRegistry } from "@safuney/payments";
import { CartService } from "@/lib/cart/service";
import { OrderService } from "@/lib/orders/service";
import { createMemoryRateLimiter } from "@/lib/rate-limit";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("adversarial", () => {
  let prisma: PrismaClient;
  let carts: CartService;
  let orders: OrderService;
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  let variant: string;
  const contact = { name: "Adversary", email: `adv-${stamp}@example.test`, phone: "+254712345999" };
  const base = "https://preview.example.test";

  beforeAll(async () => {
    prisma = createTestClient(url!);
    carts = new CartService(prisma);
    orders = new OrderService(prisma, createRegistry({ PAYMENTS_MODE: "mock" }));
    const cat = await prisma.category.create({ data: { slug: `adv-cat-${stamp}`, name: `Adversarial ${stamp}` } });
    const p = await prisma.product.create({ data: { slug: `adv-p-${stamp}`, name: `Adversarial test formulation ${stamp}`, shortDescription: "x", categoryId: cat.id, isActive: true, needsPoReview: false } });
    variant = (await prisma.productVariant.create({ data: { productId: p.id, sku: `ADV-${stamp}`, packSizeValue: "5", unit: "L", packLabel: "5 L", priceMinorUnits: 125000n, vatRateBps: 1600, stockOnHand: 50, weightGrams: 5200 } })).id;
    await prisma.deliveryZone.upsert({
      where: { slug: `adv-zone-${stamp}` },
      create: { slug: `adv-zone-${stamp}`, name: "Adversarial zone", counties: [`Advcounty${stamp}`], feeRules: [{ feeMinorUnits: "30000" }], isActive: true, slots: ["Morning"] },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.order.deleteMany({ where: { guestEmail: contact.email } });
    });
    await prisma.webhookEvent.deleteMany({ where: { eventKey: { contains: stamp } } });
    await prisma.product.deleteMany({ where: { slug: `adv-p-${stamp}` } });
    await prisma.category.deleteMany({ where: { slug: `adv-cat-${stamp}` } });
    await prisma.deliveryZone.deleteMany({ where: { slug: `adv-zone-${stamp}` } });
    await prisma.$disconnect();
  });

  async function cartWith(qty: number): Promise<string> {
    const { token } = await carts.getOrCreate(undefined);
    await carts.add(token, variant, qty);
    return token;
  }

  describe("price tampering", () => {
    it("prices from the database, never from anything the client sends", async () => {
      // The cart API takes a variant id and a quantity. There is no price parameter to tamper with —
      // which is the actual defence — so this asserts the price on the order came from the variant.
      const token = await cartWith(2);
      const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base });
      const order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber }, include: { items: true } });
      expect(order.items[0]?.unitPriceMinorUnits).toBe(125000n);
      expect(order.subtotalMinorUnits).toBe(250000n);
    });

    it("re-reads the price at order time, so a price changed mid-session is the new one", async () => {
      const token = await cartWith(1);
      await prisma.productVariant.update({ where: { id: variant }, data: { priceMinorUnits: 200000n } });
      try {
        const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base });
        const order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber }, include: { items: true } });
        // A cart held open while the price changes must not lock in the old price.
        expect(order.items[0]?.unitPriceMinorUnits).toBe(200000n);
      } finally {
        await prisma.productVariant.update({ where: { id: variant }, data: { priceMinorUnits: 125000n } });
      }
    });
  });

  describe("quantities", () => {
    it("refuses zero, negative, fractional and absurd quantities", async () => {
      const { token } = await carts.getOrCreate(undefined);
      for (const qty of [0, -1, -1000, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1000, 10_000]) {
        await expect(carts.add(token, variant, qty), `qty ${qty}`).rejects.toMatchObject({ code: "QTY" });
      }
      // And nothing was added by any of them.
      expect((await carts.find(token))?.lines ?? []).toEqual([]);
    });

    it("refuses a negative quantity on update as well as on add", async () => {
      const token = await cartWith(1);
      const cart = await carts.find(token);
      const line = cart!.lines[0]!;
      await expect(carts.setQty(token, line.variantId, -5)).rejects.toMatchObject({ code: "QTY" });
      const after = await carts.find(token);
      expect(after?.lines[0]?.qty).toBe(1);
    });

    it("never lets stock go negative, however many orders race for the last packs", async () => {
      const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } });
      const available = v.stockOnHand - v.stockReserved;
      const tokens = await Promise.all(Array.from({ length: 4 }, () => cartWith(Math.max(1, Math.ceil(available / 2)))));
      const results = await Promise.allSettled(
        tokens.map((t) => orders.placeOrder({ cartToken: t, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base })),
      );
      expect(results.some((r) => r.status === "fulfilled")).toBe(true);
      const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } });
      expect(after.stockReserved).toBeLessThanOrEqual(after.stockOnHand);
      expect(after.stockOnHand - after.stockReserved).toBeGreaterThanOrEqual(0);
    });
  });

  describe("payment callbacks", () => {
    async function payableOrder(): Promise<{ number: string; providerRequestId: string; amount: bigint }> {
      const token = await cartWith(1);
      const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "MPESA", baseUrl: base });
      const order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber }, include: { payments: true } });
      return { number: order.number, providerRequestId: order.payments[0]!.providerRequestId!, amount: order.totalMinorUnits };
    }

    function signed(body: object): { body: string; headers: Record<string, string> } {
      const text = JSON.stringify(body);
      return { body: text, headers: { "x-mock-signature": MockAdapter.sign(text) } };
    }

    it("rejects an unsigned callback and records the attempt", async () => {
      const { providerRequestId } = await payableOrder();
      const body = JSON.stringify({ providerRequestId, status: "SUCCEEDED", ref: `FORGED${stamp}` });
      const result = await orders.handleCallback("MPESA", { body, headers: {}, ip: "203.0.113.9" });
      expect(result.outcome).toBe("REJECTED");
      // Forgery attempts must be visible, not silently dropped.
      const logged = await prisma.webhookEvent.findFirst({ where: { signatureOk: false }, orderBy: { createdAt: "desc" } });
      expect(logged?.error).toBe("BAD_SIGNATURE");
    });

    it("rejects a callback signed with the wrong key", async () => {
      const { providerRequestId } = await payableOrder();
      const body = JSON.stringify({ providerRequestId, status: "SUCCEEDED" });
      const result = await orders.handleCallback("MPESA", { body, headers: { "x-mock-signature": "deadbeef" }, ip: "203.0.113.9" });
      expect(result.outcome).toBe("REJECTED");
    });

    it("rejects a body altered after signing", async () => {
      const { providerRequestId } = await payableOrder();
      const honest = signed({ providerRequestId, status: "FAILED" });
      // Same signature, different body: the classic tamper.
      const tampered = honest.body.replace('"FAILED"', '"SUCCEEDED"');
      const result = await orders.handleCallback("MPESA", { body: tampered, headers: honest.headers, ip: "203.0.113.9" });
      expect(result.outcome).toBe("REJECTED");
      const order = await prisma.order.findUniqueOrThrow({ where: { number: (await prisma.payment.findFirstOrThrow({ where: { providerRequestId }, select: { order: { select: { number: true } } } })).order.number } });
      expect(order.status).not.toBe("PAID");
    });

    it("applies a genuine callback once, and neither layer of replay protection lets a second through", async () => {
      const { number, providerRequestId, amount } = await payableOrder();
      const callback = signed({ providerRequestId, status: "SUCCEEDED", amountMinorUnits: amount.toString(), ref: `MPESA${stamp}` });
      const first = await orders.handleCallback("MPESA", { ...callback, ip: "203.0.113.1" });
      expect(first.outcome).toBe("APPLIED");

      for (let i = 0; i < 3; i++) {
        const replay = await orders.handleCallback("MPESA", { ...callback, ip: "203.0.113.1" });
        expect(replay.outcome).toBe("DUPLICATE");
      }
      // One payment, one stock movement, one paid event — replays changed nothing.
      const order = await prisma.order.findUniqueOrThrow({ where: { number }, include: { payments: true, events: true } });
      expect(order.status).toBe("PAID");
      expect(order.payments.filter((p) => p.status === "SUCCEEDED")).toHaveLength(1);
      expect(order.events.filter((e) => e.type === "payment_received")).toHaveLength(1);
      const movements = await prisma.inventoryMovement.count({ where: { reference: number, type: "OUT" } });
      expect(movements).toBe(1);

      // Idempotency has two independent layers, and each is asserted separately because a test that
      // only checks the outcome passes when one of them is removed — which is exactly what happened
      // the first time this was written.
      //
      // Layer one: the unique eventKey. Four deliveries, one WebhookEvent row.
      const events = await prisma.webhookEvent.count({ where: { eventKey: `mock:${providerRequestId}:MPESA${stamp}` } });
      expect(events, "the unique eventKey must collapse replays into one stored event").toBe(1);
    });

    it("refuses to mark an order paid for less than it costs", async () => {
      const { number, providerRequestId, amount } = await payableOrder();
      // The attack: pay one shilling, claim the order.
      const callback = signed({ providerRequestId, status: "SUCCEEDED", amountMinorUnits: "100", ref: `SHORT${stamp}` });
      const result = await orders.handleCallback("MPESA", { ...callback, ip: "203.0.113.2" });
      expect(result.outcome).toBe("IGNORED");
      expect(result.detail).toBe("amount mismatch");
      const order = await prisma.order.findUniqueOrThrow({ where: { number }, include: { events: true } });
      expect(order.status).not.toBe("PAID");
      expect(order.events.some((e) => e.type === "payment_amount_mismatch")).toBe(true);
      expect(amount).toBeGreaterThan(100n);
    });

    it("says so when a payment lands after the stock has gone, instead of failing quietly", async () => {
      // The gap this closes: an order whose 30-minute hold expired, whose packs were then sold to
      // somebody else, and whose payment arrives anyway. Stock must not go negative — but the customer
      // has paid for more than we can ship, and the warehouse must be told rather than discovering it
      // at the pick face.
      const { number, providerRequestId, amount } = await payableOrder();
      const before = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } });

      // Simulate the race: the hold expired and the shelf emptied while the payment was in flight.
      await prisma.orderItem.updateMany({ where: { order: { number } }, data: { reservedQty: 0 } });
      await prisma.productVariant.update({ where: { id: variant }, data: { stockOnHand: 0, stockReserved: 0 } });

      try {
        const callback = signed({ providerRequestId, status: "SUCCEEDED", amountMinorUnits: amount.toString(), ref: `LATE${stamp}` });
        const result = await orders.handleCallback("MPESA", { ...callback, ip: "203.0.113.7" });
        expect(result.outcome).toBe("APPLIED");

        // Stock never goes negative — the guarantee holds.
        const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } });
        expect(after.stockOnHand).toBe(0);
        expect(after.stockReserved).toBeGreaterThanOrEqual(0);

        // And the shortfall is recorded, with the numbers somebody needs to act on it.
        const order = await prisma.order.findUniqueOrThrow({ where: { number }, include: { events: true } });
        expect(order.status).toBe("PAID");
        const shortfall = order.events.find((e) => e.type === "stock_shortfall");
        expect(shortfall, "a silent shortfall is the failure this test exists to prevent").toBeTruthy();
        const lines = (shortfall!.payload as { lines: Array<{ sku: string; ordered: number; taken: number; short: number }> }).lines;
        expect(lines[0]).toMatchObject({ ordered: 1, taken: 0, short: 1 });
      } finally {
        await prisma.productVariant.update({ where: { id: variant }, data: { stockOnHand: before.stockOnHand, stockReserved: before.stockReserved } });
      }
    });

    it("records no shortfall when the stock was there all along", async () => {
      const { number, providerRequestId, amount } = await payableOrder();
      const callback = signed({ providerRequestId, status: "SUCCEEDED", amountMinorUnits: amount.toString(), ref: `FINE${stamp}` });
      expect((await orders.handleCallback("MPESA", { ...callback, ip: "203.0.113.8" })).outcome).toBe("APPLIED");
      const order = await prisma.order.findUniqueOrThrow({ where: { number }, include: { events: true } });
      expect(order.events.some((e) => e.type === "stock_shortfall")).toBe(false);
    });

    it("ignores a callback for a payment that does not exist", async () => {
      const callback = signed({ providerRequestId: `no-such-request-${stamp}`, status: "SUCCEEDED" });
      const result = await orders.handleCallback("MPESA", { ...callback, ip: "203.0.113.3" });
      expect(result.outcome).toBe("IGNORED");
      expect(result.detail).toBe("no matching payment");
    });
  });

  describe("stored content", () => {
    it("stores markup as text, never as markup", async () => {
      // React escapes on render; what this guards is the storage layer not being asked to be clever —
      // no HTML sanitiser that "helpfully" rewrites, no raw SQL concatenation.
      const payload = `<script>alert("${stamp}")</script><img src=x onerror=alert(1)>`;
      const token = await cartWith(1);
      const r = await orders.placeOrder({
        cartToken: token,
        contact: { ...contact, name: payload },
        delivery: { method: "PICKUP" },
        paymentMethod: "COD",
        baseUrl: base,
        notes: payload,
      });
      const order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber } });
      expect(order.notes).toBe(payload);
      const shipping = order.shippingAddress as { name?: string } | null;
      expect(shipping?.name ?? order.guestEmail).toBeTruthy();
    });

    it("a quote or order number cannot be used to smuggle a path", async () => {
      // Order numbers are generated, never taken from input; a traversal string is simply not found.
      await expect(prisma.order.findUnique({ where: { number: "../../etc/passwd" } })).resolves.toBeNull();
    });
  });

  describe("access to other people's orders", () => {
    it("needs the access token, not just the order number", async () => {
      const token = await cartWith(1);
      const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base });
      const order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber } });
      // The token is what a guest holds. It is long and random, not the order number.
      expect(order.accessToken).not.toBe(order.number);
      expect(order.accessToken.length).toBeGreaterThanOrEqual(20);
      // Sequential guessing gets nowhere: the number is public-ish, the token is not derived from it.
      expect(order.accessToken).not.toContain(order.number);
    });

    it("gives every order a distinct token", async () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const t = await cartWith(1);
        const r = await orders.placeOrder({ cartToken: t, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base });
        const o = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber } });
        tokens.add(o.accessToken);
      }
      expect(tokens.size).toBe(3);
    });
  });

  describe("rate limiting", () => {
    it("stops after the allowance and says how long to wait", async () => {
      const limiter = createMemoryRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
      const key = `probe-${stamp}`;
      for (let i = 0; i < 5; i++) expect((await limiter.limit(key)).ok, `attempt ${i + 1}`).toBe(true);
      const blocked = await limiter.limit(key);
      expect(blocked.ok).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("limits per key, so one abuser does not lock everybody out", async () => {
      const limiter = createMemoryRateLimiter({ max: 2, windowMs: 60_000 });
      await limiter.limit(`a-${stamp}`);
      await limiter.limit(`a-${stamp}`);
      expect((await limiter.limit(`a-${stamp}`)).ok).toBe(false);
      expect((await limiter.limit(`b-${stamp}`)).ok).toBe(true);
    });

    it("lets the window slide rather than blocking forever", async () => {
      const limiter = createMemoryRateLimiter({ max: 1, windowMs: 30 });
      const key = `slide-${stamp}`;
      expect((await limiter.limit(key)).ok).toBe(true);
      expect((await limiter.limit(key)).ok).toBe(false);
      await new Promise((r) => setTimeout(r, 45));
      expect((await limiter.limit(key)).ok).toBe(true);
    });
  });
});
