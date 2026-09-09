/** Phase 4 gate: approval workflow and credit-limit enforcement, plus price lists and organisation authorisation. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { createRegistry } from "@safuney/payments";
import { CartService } from "@/lib/cart/service";
import { OrderService } from "@/lib/orders/service";
import { OrganisationService } from "@/lib/b2b/organisations";
import { creditPosition, STOP_SUPPLY_GRACE_DAYS } from "@/lib/b2b/credit";
import { resolvePrices } from "@/lib/b2b/pricing";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("B2B: organisations, approvals, price lists and credit", () => {
  let prisma: PrismaClient;
  let carts: CartService;
  let orders: OrderService;
  let orgs: OrganisationService;
  const stamp = Date.now().toString(36);
  let variant: string; // KES 1,000 ex VAT, stock 50
  let owner: string;
  let buyer: string;
  let approver: string;
  let finance: string;
  let customerId: string;
  const base = "https://preview.example.test";
  const contact = { name: "Org Buyer", email: `b2b-${stamp}@example.test`, phone: "+254712345678" };

  beforeAll(async () => {
    prisma = createTestClient(url!);
    carts = new CartService(prisma);
    orders = new OrderService(prisma, createRegistry({ PAYMENTS_MODE: "mock" }));
    orgs = new OrganisationService(prisma);
    const cat = await prisma.category.create({ data: { slug: `b2b-cat-${stamp}`, name: "B2B test" } });
    const p = await prisma.product.create({ data: { slug: `b2b-p-${stamp}`, name: "B2B test formulation", shortDescription: "x", categoryId: cat.id, isActive: true, needsPoReview: false } });
    variant = (await prisma.productVariant.create({ data: { productId: p.id, sku: `B2B-${stamp}`, packSizeValue: "5", unit: "L", packLabel: "5 L", priceMinorUnits: 100000n, vatRateBps: 1600, stockOnHand: 50, weightGrams: 5200 } })).id;
    owner = (await prisma.user.create({ data: { email: `owner-${stamp}@example.test`, name: "Owner" } })).id;
    buyer = (await prisma.user.create({ data: { email: `buyer-${stamp}@example.test`, name: "Buyer" } })).id;
    approver = (await prisma.user.create({ data: { email: `approver-${stamp}@example.test`, name: "Approver" } })).id;
    finance = (await prisma.user.create({ data: { email: `finance-${stamp}@example.test`, name: "Finance", role: "FINANCE" } })).id;
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.invoice.deleteMany({ where: { customerId } });
      await tx.order.deleteMany({ where: { guestEmail: contact.email } });
    });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [owner, buyer, approver, finance] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner, buyer, approver, finance] } } });
    await prisma.product.deleteMany({ where: { slug: `b2b-p-${stamp}` } });
    await prisma.category.deleteMany({ where: { slug: `b2b-cat-${stamp}` } });
    await prisma.$disconnect();
  });

  async function cartWith(qty: number) {
    const c = await carts.getOrCreate(undefined);
    await carts.add(c.token, variant, qty);
    return c.token;
  }

  it("an owner creates the organisation and only an owner can invite or change members", async () => {
    const c = await orgs.create(owner, { displayName: `Test Hotel ${stamp}`, kraPin: "P051234567X", approvalThresholdMinorUnits: 300000n });
    customerId = c.id;
    expect(c.type).toBe("ORGANISATION");
    await orgs.invite(customerId, owner, `buyer-${stamp}@example.test`, "BUYER");
    await orgs.invite(customerId, owner, `approver-${stamp}@example.test`, "APPROVER");
    await expect(orgs.invite(customerId, buyer, "someone@example.test", "BUYER")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(orgs.invite(customerId, owner, `buyer-${stamp}@example.test`, "BUYER")).rejects.toMatchObject({ code: "EXISTS" });
    await expect(orgs.setMemberRole(customerId, owner, owner, "BUYER")).rejects.toMatchObject({ code: "INVALID" });
    expect(await prisma.auditLog.count({ where: { entity: "Customer", entityId: customerId, action: "organisation.create" } })).toBe(1);
  });

  it("applies the customer's price list tiers at checkout, never the client's numbers", async () => {
    const list = await prisma.priceList.create({ data: { name: `List ${stamp}`, items: { create: [{ variantId: variant, priceMinorUnits: 90000n, minQty: 1 }, { variantId: variant, priceMinorUnits: 80000n, minQty: 10 }] } } });
    await prisma.customer.update({ where: { id: customerId }, data: { priceListId: list.id } });
    const resolved = await resolvePrices(prisma, list.id, [{ variantId: variant, qty: 12, listPriceMinorUnits: 100000n }]);
    expect(resolved.get(variant)).toBe(80000n);
    const token = await cartWith(2); // 2 × 900 = 1,800 ex VAT: below the 3,000 threshold, owner places it
    const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", userId: owner, customerId, placedByRole: "OWNER", baseUrl: base });
    const order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber }, include: { items: true } });
    expect(order.items[0]!.unitPriceMinorUnits).toBe(90000n);
    expect(order.subtotalMinorUnits).toBe(180000n);
    expect(order.status).toBe("CONFIRMED");
  });

  it("a buyer's order above the threshold waits for approval; a buyer cannot approve; an approver can", async () => {
    const token = await cartWith(5); // 5 × 900 = 4,500 ex VAT ≥ 3,000
    const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", userId: buyer, customerId, placedByRole: "BUYER", baseUrl: base });
    expect(r.status).toBe("AWAITING_APPROVAL");
    expect(r.next.kind).toBe("offline");
    let order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber } });
    expect(order.reservationExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } });
    expect(v.stockReserved).toBeGreaterThanOrEqual(5);

    await expect(orders.approveOrder(order.id, buyer, base)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const approved = await orders.approveOrder(order.id, approver, base);
    expect(approved.status).toBe("CONFIRMED");
    order = await prisma.order.findUniqueOrThrow({ where: { number: r.orderNumber }, include: { events: true } } as never);
    expect(order.status).toBe("CONFIRMED");
    expect(order.approvedById).toBe(approver);
    await expect(orders.approveOrder(order.id, approver, base)).rejects.toMatchObject({ code: "STATE" });
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["order_placed", "order_approved"]));
    expect(events.find((e) => e.type === "order_approved")!.actorId).toBe(approver);
  });

  it("rejection cancels the order and releases its stock", async () => {
    const before = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } })).stockReserved;
    const token = await cartWith(4);
    const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", userId: buyer, customerId, placedByRole: "BUYER", baseUrl: base });
    expect(r.status).toBe("AWAITING_APPROVAL");
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } })).stockReserved).toBe(before + 4);
    await orders.rejectOrder(r.orderId, approver, "Over budget this month");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(order.status).toBe("CANCELLED");
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } })).stockReserved).toBe(before);
  });

  it("invoice payment needs an approved credit account and stays within the available credit", async () => {
    // Not approved yet.
    let token = await cartWith(1);
    await expect(orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "INVOICE", userId: owner, customerId, placedByRole: "OWNER", baseUrl: base })).rejects.toMatchObject({ code: "METHOD_UNAVAILABLE" });

    // Apply and get approved by finance only.
    const app = await orgs.applyForCredit(customerId, owner, { legalName: `Test Hotel ${stamp} Ltd`, kraPin: "P051234567X", requestedLimitMinorUnits: 500000n, requestedTermsDays: 30, tradeReferences: [{ company: "Supplier", contact: "Jane", phone: "+254700000000" }], documents: [] });
    await expect(orgs.decideCredit(app.id, buyer, { approved: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await orgs.decideCredit(app.id, finance, { approved: true, limitMinorUnits: 300000n, termsDays: 30 });
    let position = await creditPosition(prisma, customerId);
    expect(position).toMatchObject({ approved: true, limitMinorUnits: 300000n, outstandingMinorUnits: 0n, availableMinorUnits: 300000n, termsDays: 30 });

    // 2 × 900 + VAT = 2,088 fits; a tax invoice is issued with a 30-day due date.
    token = await cartWith(2);
    const first = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "INVOICE", userId: owner, customerId, placedByRole: "OWNER", baseUrl: base });
    expect(first.status).toBe("CONFIRMED");
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { orderId: first.orderId, type: "TAX" } });
    expect(invoice.number).toMatch(/^INV-\d{8}-\d{4}$/);
    expect(invoice.totalMinorUnits).toBe(208800n);
    expect(invoice.buyerKraPin).toBe("P051234567X");
    expect(invoice.dueDate!.getTime() - invoice.issuedAt.getTime()).toBe(30 * 86_400_000);
    position = await creditPosition(prisma, customerId);
    expect(position.outstandingMinorUnits).toBe(208800n);

    // 1 × 900 + VAT = 1,044 > 912 available: refused, naming the available credit.
    token = await cartWith(1);
    await expect(orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "INVOICE", userId: owner, customerId, placedByRole: "OWNER", baseUrl: base })).rejects.toMatchObject({ code: "CREDIT", message: expect.stringContaining("KES 912.00") });
    // Nothing was reserved by the refused order.
    const reservedBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } })).stockReserved;
    // Paying the invoice frees the credit.
    await prisma.invoice.update({ where: { id: invoice.id }, data: { paidAt: new Date() } });
    const again = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "INVOICE", userId: owner, customerId, placedByRole: "OWNER", baseUrl: base });
    expect(again.status).toBe("CONFIRMED");
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } })).stockReserved).toBe(reservedBefore + 1);
  });

  it("stops supply on credit when an invoice sits more than the grace period past its due date", async () => {
    // One unpaid invoice, pushed past its due date by more than the grace period.
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { customerId, type: "TAX" }, orderBy: { issuedAt: "desc" } });
    const wellPastDue = new Date(Date.now() - (STOP_SUPPLY_GRACE_DAYS + 2) * 86_400_000);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { paidAt: null, dueDate: wellPastDue } });

    const stopped = await creditPosition(prisma, customerId);
    expect(stopped.stopSupply).toBe(true);
    expect(stopped.overdueMinorUnits).toBe(invoice.totalMinorUnits);
    // No headroom at all while supply is stopped, whatever the limit says.
    expect(stopped.availableMinorUnits).toBe(0n);
    expect(stopped.stopSupplyReason).toContain(invoice.number);

    // Checkout refuses the method, and says which invoice to settle.
    const token = await cartWith(1);
    await expect(orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "INVOICE", userId: owner, customerId, placedByRole: "OWNER", baseUrl: base })).rejects.toMatchObject({
      code: "CREDIT",
      message: expect.stringContaining(invoice.number),
    });
    // Other methods still work: the account is stopped on credit, not shut out.
    const cod = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "COD", userId: owner, customerId, placedByRole: "OWNER", baseUrl: base });
    expect(cod.status).toBe("CONFIRMED");

    // Inside the grace period it is overdue but still supplied.
    await prisma.invoice.update({ where: { id: invoice.id }, data: { dueDate: new Date(Date.now() - 2 * 86_400_000) } });
    const grace = await creditPosition(prisma, customerId);
    expect(grace).toMatchObject({ stopSupply: false, stopSupplyReason: null });
    expect(grace.overdueMinorUnits).toBe(invoice.totalMinorUnits);
    expect(grace.availableMinorUnits).toBeGreaterThan(0n);

    await prisma.invoice.update({ where: { id: invoice.id }, data: { paidAt: new Date() } });
  });

  it("an approved invoice order above the threshold is credit-checked at approval time", async () => {
    // Available now: 300,000 − 104,400 = 195,600. 3 × 900 + VAT = 313,200 ≥ threshold and above the credit.
    const token = await cartWith(3);
    const r = await orders.placeOrder({ cartToken: token, contact, delivery: { method: "PICKUP" }, paymentMethod: "INVOICE", userId: buyer, customerId, placedByRole: "BUYER", baseUrl: base });
    expect(r.status).toBe("AWAITING_APPROVAL");
    await expect(orders.approveOrder(r.orderId, approver, base)).rejects.toMatchObject({ code: "CREDIT" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: r.orderId } })).status).toBe("AWAITING_APPROVAL");
    await orders.rejectOrder(r.orderId, approver, "No credit left this month");
  });
});
