/** Staff hear about an order once it is ready to pick, once per order. Needs a database (CI). */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";

const sent: Array<{ to: string; subject: string; text: string }> = [];
vi.mock("@/lib/email", () => ({
  sendEmail: async (m: { to: string; subject: string; text: string }) => {
    sent.push(m);
    return { sent: true, id: null };
  },
}));

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("new-order alert to staff", () => {
  let prisma: PrismaClient;
  let alertStaffIfReady: typeof import("@/lib/orders/staff-alert").alertStaffIfReady;
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  let n = 0;
  const original = { ...process.env };

  async function order(status: "CONFIRMED" | "PAID" | "PENDING_PAYMENT", paymentMethod: "COD" | "MPESA") {
    n += 1;
    return prisma.order.create({
      data: {
        number: `SFN-ALERT-${stamp}-${n}`,
        status,
        subtotalMinorUnits: 100000n,
        vatMinorUnits: 16000n,
        deliveryMinorUnits: 0n,
        totalMinorUnits: 116000n,
        paymentMethod,
        deliveryMethod: "PICKUP",
        placedAt: new Date(),
        guestEmail: `alert-${stamp}@example.test`,
        guestPhone: "+254712345678",
        billingAddress: { name: "Alert Test" },
        items: { create: [{ sku: `AL-${stamp}`, name: "SAF QUARTSAN", packLabel: "5 L", unitPriceMinorUnits: 100000n, qty: 1, vatRateBps: 1600, lineTotalMinorUnits: 100000n, lineVatMinorUnits: 16000n }] },
      },
    });
  }

  beforeAll(async () => {
    process.env["RESEND_API_KEY"] = "test-only";
    process.env["ORDERS_INBOX"] = "orders@example.test";
    prisma = createTestClient(url!);
    ({ alertStaffIfReady } = await import("@/lib/orders/staff-alert"));
  });

  beforeEach(() => {
    sent.length = 0;
  });

  afterAll(async () => {
    process.env = { ...original };
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.order.deleteMany({ where: { number: { startsWith: `SFN-ALERT-${stamp}` } } });
    });
    await prisma.$disconnect();
  });

  it("emails the orders inbox when a cash-on-delivery order is confirmed, with what the warehouse needs", async () => {
    const o = await order("CONFIRMED", "COD");
    await alertStaffIfReady({ id: o.id });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("orders@example.test");
    expect(sent[0]!.subject).toContain(o.number);
    expect(sent[0]!.subject).toContain("cash on delivery");
    expect(sent[0]!.text).toContain("1 × SAF QUARTSAN 5 L");
    expect(sent[0]!.text).toContain("Cash on delivery: collect");
    expect(sent[0]!.text).toContain(`/warehouse/${o.id}`);
    expect(await prisma.orderEvent.count({ where: { orderId: o.id, type: "staff_alerted" } })).toBe(1);
  });

  it("sends once, however many paths report the same order at the same moment", async () => {
    const o = await order("PAID", "MPESA");
    await Promise.all([alertStaffIfReady({ id: o.id }), alertStaffIfReady({ number: o.number }), alertStaffIfReady({ id: o.id })]);
    await alertStaffIfReady({ id: o.id });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toContain("paid");
  });

  it("says nothing about an order that is not ready to pick", async () => {
    const o = await order("PENDING_PAYMENT", "MPESA");
    await alertStaffIfReady({ id: o.id });
    expect(sent).toHaveLength(0);
    expect(await prisma.orderEvent.count({ where: { orderId: o.id, type: "staff_alerted" } })).toBe(0);
  });
});
