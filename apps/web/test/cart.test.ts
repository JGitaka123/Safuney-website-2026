/** Integration tests for the server-side cart. Skipped without DATABASE_URL (CI provides Postgres). */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { CartError, CartService } from "@/lib/cart/service";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("cart service", () => {
  let prisma: PrismaClient;
  let svc: CartService;
  // Unique per test file, not just per millisecond: parallel workers load these files at the same
  // instant, and two files sharing a stamp make their seeded products collide in search results.
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  let vA: string;
  let vB: string;
  let vHidden: string;

  beforeAll(async () => {
    prisma = createTestClient(url!);
    svc = new CartService(prisma);
    const cat = await prisma.category.create({ data: { slug: `cart-cat-${stamp}`, name: "Cart test" } });
    const p = await prisma.product.create({ data: { slug: `cart-p-${stamp}`, name: "Cart test degreaser", shortDescription: "x", categoryId: cat.id, isActive: true, needsPoReview: false } });
    vA = (await prisma.productVariant.create({ data: { productId: p.id, sku: `CA-${stamp}`, packSizeValue: "5", unit: "L", packLabel: "5 L", priceMinorUnits: 125000n, vatRateBps: 1600, stockOnHand: 3, weightGrams: 5200 } })).id;
    vB = (await prisma.productVariant.create({ data: { productId: p.id, sku: `CB-${stamp}`, packSizeValue: "20", unit: "L", packLabel: "20 L", priceMinorUnits: 400000n, vatRateBps: 1600, stockOnHand: 0, isMadeToOrder: true } })).id;
    const hidden = await prisma.product.create({ data: { slug: `cart-h-${stamp}`, name: "Unreviewed", shortDescription: "x", categoryId: cat.id, isActive: true, needsPoReview: true } });
    vHidden = (await prisma.productVariant.create({ data: { productId: hidden.id, sku: `CH-${stamp}`, packSizeValue: "1", unit: "L", packLabel: "1 L", priceMinorUnits: 1000n, stockOnHand: 10 } })).id;
  });

  afterAll(async () => {
    await prisma.cart.deleteMany({ where: { items: { some: { variant: { sku: { endsWith: stamp } } } } } });
    await prisma.product.deleteMany({ where: { slug: { endsWith: stamp } } });
    await prisma.category.deleteMany({ where: { slug: `cart-cat-${stamp}` } });
    await prisma.$disconnect();
  });

  it("creates a cart, adds lines and recomputes totals server-side", async () => {
    const cart = await svc.getOrCreate(undefined);
    expect(cart.lines).toEqual([]);
    const after = await svc.add(cart.token, vA, 2);
    expect(after.lines[0]?.qty).toBe(2);
    expect(after.subtotalMinorUnits).toBe(250000n);
    expect(after.vatMinorUnits).toBe(40000n);
    expect(after.totalMinorUnits).toBe(290000n);
    expect(after.weightGrams).toBe(10400);
    const more = await svc.add(cart.token, vA, 1);
    expect(more.lines[0]?.qty).toBe(3);
    expect(more.itemCount).toBe(3);
  });

  it("refuses more than the available stock but allows made-to-order", async () => {
    const cart = await svc.getOrCreate(undefined);
    await expect(svc.add(cart.token, vA, 4)).rejects.toMatchObject({ code: "STOCK" });
    const ok = await svc.add(cart.token, vB, 50);
    expect(ok.lines.find((l) => l.variantId === vB)?.qty).toBe(50);
  });

  it("refuses unreviewed products and bad quantities", async () => {
    const cart = await svc.getOrCreate(undefined);
    await expect(svc.add(cart.token, vHidden, 1)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    await expect(svc.add(cart.token, vA, 0)).rejects.toBeInstanceOf(CartError);
    await expect(svc.add(cart.token, vA, 1.5)).rejects.toMatchObject({ code: "QTY" });
  });

  it("sets quantity and removes with zero", async () => {
    const cart = await svc.getOrCreate(undefined);
    await svc.add(cart.token, vA, 1);
    const set = await svc.setQty(cart.token, vA, 3);
    expect(set.lines[0]?.qty).toBe(3);
    const removed = await svc.setQty(cart.token, vA, 0);
    expect(removed.lines).toEqual([]);
  });

  it("adds many with per-line failures reported", async () => {
    const cart = await svc.getOrCreate(undefined);
    const { cart: c, failures } = await svc.addMany(cart.token, [
      { variantId: vA, qty: 2 },
      { variantId: vA, qty: 5 },
      { variantId: vHidden, qty: 1 },
    ]);
    expect(c.lines.find((l) => l.variantId === vA)?.qty).toBe(2);
    expect(failures.map((f) => f.variantId)).toEqual([vA, vHidden]);
  });

  it("merges a guest cart into the user's cart on login", async () => {
    const userId = (await prisma.user.create({ data: { email: `cart-${stamp}@example.test` } })).id;
    const guest = await svc.getOrCreate(undefined);
    await svc.add(guest.token, vA, 1);
    const userCart = await svc.getOrCreate(undefined, userId);
    await svc.add(userCart.token, vA, 1);
    const merged = await svc.mergeInto(guest.token, userId);
    expect(merged.lines.find((l) => l.variantId === vA)?.qty).toBe(2);
    expect(await prisma.cart.findFirst({ where: { token: guest.token } })).toBeNull();
    await prisma.user.delete({ where: { id: userId } });
  });

  it("marks lines unavailable when a product is withdrawn instead of silently dropping them", async () => {
    const cart = await svc.getOrCreate(undefined);
    await svc.add(cart.token, vA, 1);
    await prisma.productVariant.update({ where: { id: vA }, data: { isActive: false } });
    const c = await svc.find(cart.token);
    expect(c?.lines[0]?.unavailable).toBe(true);
    expect(c?.subtotalMinorUnits).toBe(0n);
    await prisma.productVariant.update({ where: { id: vA }, data: { isActive: true } });
  });
});
