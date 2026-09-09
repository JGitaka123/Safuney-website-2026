/** Phase 5 gate: warehouse transitions are staff-only and move stock exactly once. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { MockAdapter, createRegistry } from "@safuney/payments";
import { CartService } from "@/lib/cart/service";
import { OrderService } from "@/lib/orders/service";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("warehouse", () => {
  let prisma: PrismaClient;
  let carts: CartService;
  let orders: OrderService;
  const stamp = Date.now().toString(36);
  let variant: string;
  let warehouse: string;
  let customer: string;
  const contact = { name: "Wh Buyer", email: `wh-${stamp}@example.test`, phone: "+254712345678" };
  const base = "https://preview.example.test";

  beforeAll(async () => {
    prisma = createTestClient(url!);
    carts = new CartService(prisma);
    orders = new OrderService(prisma, createRegistry({ PAYMENTS_MODE: "mock" }));
    const cat = await prisma.category.create({ data: { slug: `wh-cat-${stamp}`, name: "Warehouse test" } });
    const p = await prisma.product.create({ data: { slug: `wh-p-${stamp}`, name: "Warehouse test formulation", shortDescription: "x", categoryId: cat.id, isActive: true, needsPoReview: false } });
    variant = (await prisma.productVariant.create({ data: { productId: p.id, sku: `WH-${stamp}`, packSizeValue: "5", unit: "L", packLabel: "5 L", priceMinorUnits: 100000n, vatRateBps: 1600, stockOnHand: 20, weightGrams: 5200 } })).id;
    warehouse = (await prisma.user.create({ data: { email: `wh-staff-${stamp}@example.test`, role: "WAREHOUSE" } })).id;
    customer = (await prisma.user.create({ data: { email: `wh-cust-${stamp}@example.test`, role: "CUSTOMER" } })).id;
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.order.deleteMany({ where: { guestEmail: contact.email } });
    });
    await prisma.webhookEvent.deleteMany({ where: { eventKey: { contains: stamp } } });
    await prisma.user.deleteMany({ where: { id: { in: [warehouse, customer] } } });
    await prisma.product.deleteMany({ where: { slug: `wh-p-${stamp}` } });
    await prisma.category.deleteMany({ where: { slug: `wh-cat-${stamp}` } });
    await prisma.$disconnect();
  });

  async function place(method: "COD" | "MPESA", qty: number) {
    const c = await carts.getOrCreate(undefined);
    await carts.add(c.token, variant, qty);
    return orders.placeOrder({ cartToken: c.token, contact, delivery: { method: "PICKUP" }, paymentMethod: method, baseUrl: base });
  }

  async function stock() {
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant } });
    return { onHand: v.stockOnHand, reserved: v.stockReserved };
  }

  it("customers cannot touch fulfilment; the queue and pick list are staff-only", async () => {
    const r = await place("COD", 2);
    await expect(orders.markPacked(r.orderId, customer)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(orders.warehouseQueue(customer)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const pick = await orders.pickList(r.orderId, warehouse);
    expect(pick.lines).toEqual([{ sku: `WH-${stamp}`, name: "Warehouse test formulation", packLabel: "5 L", qty: 2 }]);
    expect((await orders.warehouseQueue(warehouse)).some((o) => o.id === r.orderId)).toBe(true);
  });

  it("a cash-on-delivery order: packed → dispatched moves stock once → delivered → collection recorded", async () => {
    const before = await stock();
    const r = await place("COD", 3);
    expect(await stock()).toEqual({ onHand: before.onHand, reserved: before.reserved + 3 });

    await expect(orders.dispatch(r.orderId, warehouse, { name: "Rider Joe", phone: "0700000000" })).rejects.toMatchObject({ code: "STATE" });
    await orders.markPacked(r.orderId, warehouse);
    await expect(orders.markPacked(r.orderId, warehouse)).rejects.toMatchObject({ code: "STATE" });
    await orders.dispatch(r.orderId, warehouse, { name: "Rider Joe", phone: "0700000000" });
    expect(await stock()).toEqual({ onHand: before.onHand - 3, reserved: before.reserved });
    await expect(orders.dispatch(r.orderId, warehouse, { name: "Rider Joe", phone: "" })).rejects.toMatchObject({ code: "STATE" });
    expect(await stock()).toEqual({ onHand: before.onHand - 3, reserved: before.reserved });

    await expect(orders.recordCodCollection(r.orderId, warehouse, { amountMinorUnits: 1000n })).rejects.toMatchObject({ code: "STATE" });
    await orders.recordCodCollection(r.orderId, warehouse, { amountMinorUnits: r.totalMinorUnits, mpesaRef: "RKT1ABC2DE" });
    await expect(orders.recordCodCollection(r.orderId, warehouse, { amountMinorUnits: r.totalMinorUnits })).rejects.toMatchObject({ code: "STATE" });
    await orders.markDelivered(r.orderId, warehouse, { name: "Chef Otieno" });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { fulfilment: true, payments: true, events: true } });
    expect(order.status).toBe("DELIVERED");
    expect(order.fulfilment).toMatchObject({ riderName: "Rider Joe", podName: "Chef Otieno", codMpesaRef: "RKT1ABC2DE", codCollectedMinorUnits: r.totalMinorUnits });
    expect(order.payments.filter((p) => p.provider === "COD" && p.status === "SUCCEEDED")).toHaveLength(1);
    expect(order.events.map((e) => e.type)).toEqual(expect.arrayContaining(["order_packed", "order_dispatched", "cod_collected", "order_delivered"]));
    expect(order.events.filter((e) => e.type === "order_dispatched")[0]!.actorId).toBe(warehouse);
    const movements = await prisma.inventoryMovement.findMany({ where: { variantId: variant, reference: r.orderNumber, type: "OUT" } });
    expect(movements).toHaveLength(1);
  });

  it("a paid M-Pesa order dispatches without touching on-hand twice", async () => {
    const before = await stock();
    const r = await place("MPESA", 2);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: r.orderId } });
    const body = JSON.stringify({ providerRequestId: payment.providerRequestId, status: "SUCCEEDED", amountMinorUnits: r.totalMinorUnits.toString() });
    await orders.handleCallback("MPESA", { body, headers: { "x-mock-signature": MockAdapter.sign(body) } });
    const paid = await stock();
    expect(paid.onHand).toBe(before.onHand - 2);
    expect(paid.reserved).toBe(before.reserved);
    await orders.markPacked(r.orderId, warehouse);
    await orders.dispatch(r.orderId, warehouse, { name: "Rider Amina", phone: "" });
    expect(await stock()).toEqual(paid);
    await expect(orders.recordCodCollection(r.orderId, warehouse, { amountMinorUnits: r.totalMinorUnits })).rejects.toMatchObject({ code: "STATE" });
  });
});
