/** Adding a proven email or phone, and merging the account that already had it. Needs a database (CI). */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { confirmContact } from "@/lib/account/contacts";
import { ProfileError } from "@/lib/account/profile";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("one account for email and phone", () => {
  let prisma: PrismaClient;
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const users: string[] = [];
  const customers: string[] = [];
  let n = 0;

  const email = (tag: string) => `${tag}-${stamp}@example.test`;
  const phone = () => `+2547${String(Date.now() + (n += 1)).slice(-8)}`;

  async function user(data: { email?: string; phone?: string; name?: string; role?: "CUSTOMER" | "B2B_BUYER" | "SALES"; isActive?: boolean }) {
    const now = new Date();
    const u = await prisma.user.create({ data: { email: data.email ?? null, phone: data.phone ?? null, name: data.name ?? null, role: data.role ?? "CUSTOMER", isActive: data.isActive ?? true, emailVerified: data.email ? now : null, phoneVerified: data.phone ? now : null } });
    users.push(u.id);
    return u.id;
  }

  async function personal(userId: string, withDefaultAddress: boolean) {
    const c = await prisma.customer.create({ data: { type: "INDIVIDUAL", displayName: "Test", members: { create: { userId, role: "OWNER" } }, addresses: { create: { recipientName: "Test", phone: "+254700000000", county: "Nairobi", town: "Westlands", isDefault: withDefaultAddress } } } });
    customers.push(c.id);
    return c.id;
  }

  async function order(userId: string) {
    n += 1;
    return prisma.order.create({
      data: { number: `SFN-MERGE-${stamp}-${n}`, status: "DELIVERED", subtotalMinorUnits: 100000n, vatMinorUnits: 16000n, deliveryMinorUnits: 0n, totalMinorUnits: 116000n, paymentMethod: "MPESA", deliveryMethod: "PICKUP", placedAt: new Date(), userId },
    });
  }

  beforeAll(() => {
    prisma = createTestClient(url!);
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.order.deleteMany({ where: { number: { startsWith: `SFN-MERGE-${stamp}` } } });
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await prisma.customer.deleteMany({ where: { id: { in: customers } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  it("adds a contact nobody else has, marked as proven", async () => {
    const me = await user({ phone: phone() });
    const address = email("free");
    expect(await confirmContact(prisma, me, "email", address)).toEqual({ merged: false });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: me } });
    expect(u.email).toBe(address);
    expect(u.emailVerified).not.toBeNull();
  });

  it("brings in the other account's orders, addresses, organisations, reviews and contacts", async () => {
    const theirPhone = phone();
    const theirs = await user({ phone: theirPhone, name: "Achieng", role: "B2B_BUYER" });
    const mine = await user({ email: email("mine") });
    const theirCustomer = await personal(theirs, true);
    const myCustomer = await personal(mine, true);
    const theirOrder = await order(theirs);

    const org = await prisma.customer.create({ data: { type: "ORGANISATION", displayName: "Org", members: { create: [{ userId: theirs, role: "APPROVER" }, { userId: mine, role: "BUYER" }] } } });
    customers.push(org.id);
    const [p1, p2] = await prisma.product.findMany({ take: 2, select: { id: true } });
    await prisma.review.create({ data: { productId: p1!.id, userId: theirs, rating: 5, body: "theirs, same product" } });
    await prisma.review.create({ data: { productId: p1!.id, userId: mine, rating: 4, body: "mine" } });
    await prisma.review.create({ data: { productId: p2!.id, userId: theirs, rating: 3, body: "theirs, other product" } });

    expect(await confirmContact(prisma, mine, "phone", theirPhone)).toEqual({ merged: true });

    const me = await prisma.user.findUniqueOrThrow({ where: { id: mine } });
    expect(me.phone).toBe(theirPhone);
    expect(me.phoneVerified).not.toBeNull();
    expect(me.email).toBe(email("mine"));
    expect(me.name).toBe("Achieng");
    expect(me.role).toBe("B2B_BUYER");

    const old = await prisma.user.findUniqueOrThrow({ where: { id: theirs } });
    expect(old).toMatchObject({ isActive: false, email: null, phone: null, name: null });

    expect((await prisma.order.findUniqueOrThrow({ where: { id: theirOrder.id } })).userId).toBe(mine);
    const addresses = await prisma.address.findMany({ where: { customerId: myCustomer } });
    expect(addresses).toHaveLength(2);
    expect(addresses.filter((a) => a.isDefault)).toHaveLength(1);
    expect(await prisma.address.count({ where: { customerId: theirCustomer } })).toBe(0);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: theirCustomer } })).status).toBe("SUSPENDED");

    const memberships = await prisma.customerMember.findMany({ where: { customerId: org.id } });
    expect(memberships).toEqual([expect.objectContaining({ userId: mine, role: "APPROVER" })]);

    const reviews = await prisma.review.findMany({ where: { userId: mine }, orderBy: { body: "asc" } });
    expect(reviews.map((r) => r.body)).toEqual(["mine", "theirs, other product"]);
    expect(await prisma.auditLog.count({ where: { actorId: mine, action: "account.merge" } })).toBe(1);
  });

  it("puts the proven contact in place of the one this account had", async () => {
    const theirPhone = phone();
    const myOldPhone = phone();
    await user({ phone: theirPhone, email: email("theirs-too") });
    const mine = await user({ phone: myOldPhone, email: email("mine-too") });
    await confirmContact(prisma, mine, "phone", theirPhone);
    const me = await prisma.user.findUniqueOrThrow({ where: { id: mine } });
    expect(me.phone).toBe(theirPhone);
    // Both had an email: this account keeps its own.
    expect(me.email).toBe(email("mine-too"));
  });

  it("takes over the other account's personal record when this one has none", async () => {
    const theirEmail = email("solo");
    const theirs = await user({ email: theirEmail });
    const mine = await user({ phone: phone() });
    const theirCustomer = await personal(theirs, true);
    await confirmContact(prisma, mine, "email", theirEmail);
    const member = await prisma.customerMember.findFirstOrThrow({ where: { customerId: theirCustomer } });
    expect(member.userId).toBe(mine);
  });

  it("never merges a staff account, nor into one, and leaves a switched-off account alone", async () => {
    const staffEmail = email("staff");
    await user({ email: staffEmail, role: "SALES" });
    const customer = await user({ phone: phone() });
    await expect(confirmContact(prisma, customer, "email", staffEmail)).rejects.toBeInstanceOf(ProfileError);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer } })).email).toBeNull();

    const customerPhone = phone();
    await user({ phone: customerPhone });
    const staff = await user({ email: email("staff2"), role: "SALES" });
    await expect(confirmContact(prisma, staff, "phone", customerPhone)).rejects.toBeInstanceOf(ProfileError);

    const offPhone = phone();
    const off = await user({ phone: offPhone, isActive: false });
    await expect(confirmContact(prisma, customer, "phone", offPhone)).rejects.toBeInstanceOf(ProfileError);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: off } })).phone).toBe(offPhone);
  });
});
