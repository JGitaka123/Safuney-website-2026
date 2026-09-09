/**
 * Integration tests for database-level invariants (migration 20260909070000).
 * Skipped when DATABASE_URL is not set. CI provides a Postgres service.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient } from "../src/index";
import type { PrismaClient } from "../src/index";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("database invariants", () => {
  let prisma: PrismaClient;
  let variantId: string;
  let orderId: string;
  const stamp = Date.now().toString(36);

  beforeAll(async () => {
    prisma = createTestClient(url!);
    const cat = await prisma.category.upsert({
      where: { slug: `t-cat-${stamp}` },
      create: { slug: `t-cat-${stamp}`, name: "Test category" },
      update: {},
    });
    const product = await prisma.product.create({
      data: { slug: `t-prod-${stamp}`, name: "Test degreaser", shortDescription: "x", categoryId: cat.id },
    });
    const v = await prisma.productVariant.create({
      data: { productId: product.id, sku: `T-${stamp}`, packSizeValue: "5", unit: "L", packLabel: "5 L", stockOnHand: 10, priceMinorUnits: 100000n },
    });
    variantId = v.id;
    const order = await prisma.order.create({
      data: {
        number: `SFN-TEST-${stamp}`,
        status: "PENDING_PAYMENT",
        subtotalMinorUnits: 100000n,
        vatMinorUnits: 16000n,
        deliveryMinorUnits: 0n,
        totalMinorUnits: 116000n,
        paymentMethod: "MPESA",
        deliveryMethod: "PICKUP",
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.order.deleteMany({ where: { number: { startsWith: "SFN-TEST-" } } });
    });
    await prisma.product.deleteMany({ where: { slug: { startsWith: "t-prod-" } } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: "t-cat-" } } });
    await prisma.$disconnect();
  });

  it("rejects negative stock on hand", async () => {
    await expect(prisma.productVariant.update({ where: { id: variantId }, data: { stockOnHand: -1, stockReserved: 0 } })).rejects.toThrow(/ProductVariant_(stock_non_negative|reserved_lte_on_hand)/);
  });

  it("rejects reserving more than is on hand", async () => {
    await expect(prisma.productVariant.update({ where: { id: variantId }, data: { stockReserved: 11 } })).rejects.toThrow(/reserved_lte_on_hand/);
    await prisma.productVariant.update({ where: { id: variantId }, data: { stockReserved: 10 } });
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(v.stockReserved).toBe(10);
  });

  it("rejects a cart or order line with quantity 0", async () => {
    await expect(prisma.orderItem.create({
      data: { orderId, sku: "X", name: "x", packLabel: "x", unitPriceMinorUnits: 1n, qty: 0, vatRateBps: 1600, lineTotalMinorUnits: 0n, lineVatMinorUnits: 0n },
    })).rejects.toThrow(/qty_positive/);
  });

  it("makes order events append-only", async () => {
    const ev = await prisma.orderEvent.create({ data: { orderId, status: "PAID", type: "status_changed" } });
    await expect(prisma.orderEvent.update({ where: { id: ev.id }, data: { type: "tampered" } })).rejects.toThrow(/append-only/);
    await expect(prisma.orderEvent.delete({ where: { id: ev.id } })).rejects.toThrow(/append-only/);
    // Even inside a transaction with the delete escape hatch, UPDATE stays forbidden.
    await expect(prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.orderEvent.update({ where: { id: ev.id }, data: { type: "tampered" } });
    })).rejects.toThrow(/append-only/);
    const still = await prisma.orderEvent.findUnique({ where: { id: ev.id } });
    expect(still?.type).toBe("status_changed");
  });

  it("rejects a payment callback replay via the idempotency key", async () => {
    const data = { orderId, provider: "MPESA_DARAJA" as const, amountMinorUnits: 116000n, idempotencyKey: `cb-${stamp}` };
    await prisma.payment.create({ data });
    await expect(prisma.payment.create({ data })).rejects.toThrow(/Unique constraint/);
  });

  it("maintains the product search vector by trigger", async () => {
    const rows = await prisma.$queryRaw<Array<{ slug: string }>>`
      SELECT slug FROM "Product" WHERE "searchVector" @@ plainto_tsquery('english', 'degreaser') AND slug = ${`t-prod-${stamp}`}`;
    expect(rows.map((r) => r.slug)).toContain(`t-prod-${stamp}`);
  });
});
