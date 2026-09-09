/** Phase 4: request-for-quote → sales pricing → acceptance converts to an order at the quoted prices. */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { createRegistry } from "@safuney/payments";
import { OrderService } from "@/lib/orders/service";
import { QuoteService } from "@/lib/b2b/quotes";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("quotes", () => {
  let prisma: PrismaClient;
  let quotes: QuoteService;
  // Unique per test file, not just per millisecond: parallel workers load these files at the same
  // instant, and two files sharing a stamp make their seeded products collide in search results.
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  let variant: string;
  let sales: string;
  let customerUser: string;
  const email = `quote-${stamp}@example.test`;
  const base = "https://preview.example.test";
  let clock = new Date();

  beforeAll(async () => {
    prisma = createTestClient(url!);
    const orders = new OrderService(prisma, createRegistry({ PAYMENTS_MODE: "mock" }), () => clock);
    quotes = new QuoteService(prisma, orders, () => clock);
    const cat = await prisma.category.create({ data: { slug: `q-cat-${stamp}`, name: "Quote test" } });
    const p = await prisma.product.create({ data: { slug: `q-p-${stamp}`, name: "Quote test formulation", shortDescription: "x", categoryId: cat.id, isActive: true, needsPoReview: false } });
    variant = (await prisma.productVariant.create({ data: { productId: p.id, sku: `QT-${stamp}`, packSizeValue: "20", unit: "L", packLabel: "20 L", priceMinorUnits: 500000n, vatRateBps: 1600, stockOnHand: 40, weightGrams: 21000 } })).id;
    sales = (await prisma.user.create({ data: { email: `sales-${stamp}@example.test`, role: "SALES" } })).id;
    customerUser = (await prisma.user.create({ data: { email, role: "CUSTOMER" } })).id;
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.quote.deleteMany({ where: { contactEmail: email } });
      await tx.order.deleteMany({ where: { guestEmail: email } });
    });
    await prisma.lead.deleteMany({ where: { email } });
    await prisma.auditLog.deleteMany({ where: { entity: "Quote" } });
    await prisma.user.deleteMany({ where: { id: { in: [sales, customerUser] } } });
    await prisma.product.deleteMany({ where: { slug: `q-p-${stamp}` } });
    await prisma.category.deleteMany({ where: { slug: `q-cat-${stamp}` } });
    await prisma.$disconnect();
  });

  it("records the request as a quote and a lead, and only sales can price it", async () => {
    const q = await quotes.request({ contactName: "Quote Buyer", contactEmail: email, contactPhone: "+254712345678", lines: [{ description: "Chlorine disinfectant 20 L", qty: 10 }, { description: "Something we do not stock", qty: 2 }], userId: customerUser });
    expect(q.number).toMatch(/^QUO-\d{8}-\d{4}$/);
    expect(q.status).toBe("REQUESTED");
    expect(await prisma.lead.count({ where: { email, kind: "QUOTE_REQUEST" } })).toBe(1);
    await expect(quotes.price(customerUser, q.id, { lines: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(quotes.open(q.number, "wrong-token")).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Every line must be attached to a pack; the unstocked line cannot be priced as-is.
    await expect(quotes.price(sales, q.id, { lines: q.items.map((i) => ({ itemId: i.id, variantId: "nope", unitPriceMinorUnits: 450000n, qty: i.qty })) })).rejects.toMatchObject({ code: "INVALID" });
  });

  it("prices, accepts at the quoted prices, converts to an order, and cannot be accepted twice", async () => {
    const q = await quotes.request({ contactName: "Quote Buyer", contactEmail: email, contactPhone: "+254712345678", lines: [{ variantId: variant, description: "Quote test formulation 20 L", qty: 10 }] });
    const priced = await quotes.price(sales, q.id, { lines: [{ itemId: q.items[0]!.id, variantId: variant, unitPriceMinorUnits: 450000n, qty: 10 }], validDays: 14, salesNote: "Pallet price." });
    expect(priced.status).toBe("PRICED");
    expect(priced.validUntil!.getTime()).toBeGreaterThan(Date.now());
    const opened = await quotes.open(q.number, q.accessToken);
    expect(opened.items[0]!.unitPriceMinorUnits).toBe(450000n);

    const result = await quotes.accept(q.number, q.accessToken, { delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: true } });
    expect(order.items[0]!.unitPriceMinorUnits).toBe(450000n);
    expect(order.subtotalMinorUnits).toBe(4500000n);
    expect(order.status).toBe("CONFIRMED");
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(after.status).toBe("CONVERTED");
    expect(after.orderId).toBe(order.id);
    await expect(quotes.accept(q.number, q.accessToken, { delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base })).rejects.toMatchObject({ code: "STATE" });
  });

  it("expires after its validity and can be declined while open", async () => {
    const q = await quotes.request({ contactName: "Quote Buyer", contactEmail: email, contactPhone: "+254712345678", lines: [{ variantId: variant, description: "Quote test formulation 20 L", qty: 1 }] });
    await quotes.price(sales, q.id, { lines: [{ itemId: q.items[0]!.id, variantId: variant, unitPriceMinorUnits: 480000n, qty: 1 }], validDays: 7 });
    clock = new Date(Date.now() + 8 * 86_400_000);
    const opened = await quotes.open(q.number, q.accessToken);
    expect(opened.status).toBe("EXPIRED");
    await expect(quotes.accept(q.number, q.accessToken, { delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base })).rejects.toMatchObject({ code: "STATE" });
    clock = new Date();
    const q2 = await quotes.request({ contactName: "Quote Buyer", contactEmail: email, contactPhone: "+254712345678", lines: [{ variantId: variant, description: "Quote test formulation 20 L", qty: 1 }] });
    await quotes.decline(q2.number, q2.accessToken, "Found it cheaper");
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: q2.id } })).status).toBe("DECLINED");
  });

  it("a forwarded quote link cannot spend an organisation's credit or skip its approval threshold", async () => {
    const org = await prisma.customer.create({
      data: { type: "ORGANISATION", displayName: `Quote Org ${stamp}`, status: "CREDIT_APPROVED", creditLimitMinorUnits: 10_000_00n, creditTermsDays: 30, approvalThresholdMinorUnits: 1000n, members: { create: { userId: customerUser, role: "BUYER" } } },
    });
    const q = await quotes.request({ contactName: "Org Buyer", contactEmail: email, contactPhone: "+254712345678", lines: [{ variantId: variant, description: "Quote test formulation 20 L", qty: 2 }], customerId: org.id });
    const priced = await quotes.price(sales, q.id, { lines: q.items.map((i) => ({ itemId: i.id, variantId: variant, unitPriceMinorUnits: 500000n, qty: 2 })) });

    // Signed out, holding only the link: invoice is refused outright.
    await expect(quotes.accept(priced.number, priced.accessToken, { delivery: { method: "PICKUP" }, paymentMethod: "INVOICE", baseUrl: base })).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Signed out on another method: the order is placed, but never attached to the organisation.
    const guest = await quotes.accept(priced.number, priced.accessToken, { delivery: { method: "PICKUP" }, paymentMethod: "COD", baseUrl: base });
    const guestOrder = await prisma.order.findUniqueOrThrow({ where: { id: guest.orderId } });
    expect(guestOrder.customerId).toBeNull();
    expect(guestOrder.status).toBe("CONFIRMED");

    // The member's own acceptance is attached, and their buyer role puts it through approval.
    const q2 = await quotes.request({ contactName: "Org Buyer", contactEmail: email, contactPhone: "+254712345678", lines: [{ variantId: variant, description: "Quote test formulation 20 L", qty: 2 }], customerId: org.id });
    const priced2 = await quotes.price(sales, q2.id, { lines: q2.items.map((i) => ({ itemId: i.id, variantId: variant, unitPriceMinorUnits: 500000n, qty: 2 })) });
    const member = await quotes.accept(priced2.number, priced2.accessToken, { delivery: { method: "PICKUP" }, paymentMethod: "COD", userId: customerUser, baseUrl: base });
    const memberOrder = await prisma.order.findUniqueOrThrow({ where: { id: member.orderId } });
    expect(memberOrder.customerId).toBe(org.id);
    expect(memberOrder.status).toBe("AWAITING_APPROVAL");

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.order.deleteMany({ where: { id: { in: [guest.orderId, member.orderId] } } });
    });
    await prisma.customer.delete({ where: { id: org.id } });
  });
});
