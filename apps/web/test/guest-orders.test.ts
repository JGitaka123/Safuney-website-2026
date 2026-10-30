/** Guest orders reach the account that signs in with the same, verified, email or phone. Needs a database (CI). */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { claimGuestOrders } from "@/lib/account/guest-orders";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("guest orders in the account", () => {
  let prisma: PrismaClient;
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const email = `guest-${stamp}@example.test`;
  const phone = `+2547${String(Date.now()).slice(-8)}`;
  const users: string[] = [];
  let n = 0;

  async function guestOrder(contact: { email?: string; phone?: string; userId?: string }) {
    n += 1;
    return prisma.order.create({
      data: {
        number: `SFN-GUEST-${stamp}-${n}`,
        status: "PAID",
        subtotalMinorUnits: 100000n,
        vatMinorUnits: 16000n,
        deliveryMinorUnits: 0n,
        totalMinorUnits: 116000n,
        paymentMethod: "MPESA",
        deliveryMethod: "PICKUP",
        placedAt: new Date(),
        guestEmail: contact.email ?? null,
        guestPhone: contact.phone ?? null,
        userId: contact.userId ?? null,
      },
    });
  }

  async function user(data: { email?: string; phone?: string; verified: boolean; role?: "CUSTOMER" | "SALES" }) {
    const u = await prisma.user.create({
      data: { email: data.email ?? null, phone: data.phone ?? null, role: data.role ?? "CUSTOMER", emailVerified: data.verified && data.email ? new Date() : null, phoneVerified: data.verified && data.phone ? new Date() : null },
    });
    users.push(u.id);
    return u.id;
  }

  beforeAll(() => {
    prisma = createTestClient(url!);
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.order.deleteMany({ where: { number: { startsWith: `SFN-GUEST-${stamp}` } } });
    });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  it("attaches orders placed with the same verified email, whatever its case, and leaves others alone", async () => {
    const mine = await guestOrder({ email: email.toUpperCase() });
    const someoneElses = await guestOrder({ email: `other-${email}` });
    const id = await user({ email, verified: true });
    expect(await claimGuestOrders(prisma, id)).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: mine.id } })).userId).toBe(id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: someoneElses.id } })).userId).toBeNull();
    // Running again on every sign-in changes nothing.
    expect(await claimGuestOrders(prisma, id)).toBe(0);
  });

  it("attaches orders placed with the same verified phone", async () => {
    const order = await guestOrder({ phone });
    const id = await user({ phone, verified: true });
    expect(await claimGuestOrders(prisma, id)).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).userId).toBe(id);
  });

  it("ignores an address nobody has proven, such as one typed into a profile", async () => {
    const order = await guestOrder({ email: `unproven-${email}` });
    const id = await user({ email: `unproven-${email}`, verified: false });
    expect(await claimGuestOrders(prisma, id)).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).userId).toBeNull();
  });

  it("never moves an order that already belongs to an account, and skips staff", async () => {
    const owner = await user({ email: `owner-${email}`, verified: true });
    const owned = await guestOrder({ email: `shared-${email}`, userId: owner });
    const claimant = await user({ email: `shared-${email}`, verified: true });
    expect(await claimGuestOrders(prisma, claimant)).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: owned.id } })).userId).toBe(owner);

    await guestOrder({ email: `staff-${email}` });
    const staff = await user({ email: `staff-${email}`, verified: true, role: "SALES" });
    expect(await claimGuestOrders(prisma, staff)).toBe(0);
  });
});
