/** The customer's "payment received" message goes out once, whichever path saw the payment. Needs a database (CI). */
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

run("payment receipt to the customer", () => {
  let prisma: PrismaClient;
  let mod: typeof import("@/lib/orders/after-callback");
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const customer = `receipt-${stamp}@example.test`;
  let n = 0;
  const original = { ...process.env };
  const receipts = () => sent.filter((m) => m.to === customer);

  async function order(status: "PAID" | "PENDING_PAYMENT", confirmedAt: Date | null) {
    n += 1;
    return prisma.order.create({
      data: {
        number: `SFN-RCPT-${stamp}-${n}`,
        status,
        subtotalMinorUnits: 100000n,
        vatMinorUnits: 16000n,
        deliveryMinorUnits: 0n,
        totalMinorUnits: 116000n,
        paymentMethod: "MPESA",
        deliveryMethod: "PICKUP",
        placedAt: new Date(),
        guestEmail: customer,
        guestPhone: "+254712345678",
        billingAddress: { name: "Receipt Test" },
        items: { create: [{ sku: `RC-${stamp}`, name: "SAF QUARTSAN", packLabel: "5 L", unitPriceMinorUnits: 100000n, qty: 1, vatRateBps: 1600, lineTotalMinorUnits: 100000n, lineVatMinorUnits: 16000n }] },
        payments: {
          create: [{ provider: "MPESA_DARAJA", amountMinorUnits: 116000n, status: confirmedAt ? "SUCCEEDED" : "PENDING", providerRef: `QK${stamp.toUpperCase()}${n}`, idempotencyKey: `rcpt-${stamp}-${n}`, confirmedAt }],
        },
      },
    });
  }

  beforeAll(async () => {
    process.env["RESEND_API_KEY"] = "test-only";
    process.env["ORDERS_INBOX"] = "orders@example.test";
    prisma = createTestClient(url!);
    mod = await import("@/lib/orders/after-callback");
  });

  beforeEach(() => {
    sent.length = 0;
  });

  afterAll(async () => {
    process.env = { ...original };
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.order.deleteMany({ where: { number: { startsWith: `SFN-RCPT-${stamp}` } } });
    });
    await prisma.$disconnect();
  });

  it("sends the receipt when the status poll saw the payment, and not again when the late callback arrives", async () => {
    const o = await order("PAID", new Date());
    await mod.notifyIfPaid({ outcome: "APPLIED", orderNumber: o.number }); // the poll
    await mod.notifyIfPaid({ outcome: "DUPLICATE", orderNumber: o.number }); // the provider's callback, late
    expect(receipts()).toHaveLength(1);
    expect(receipts()[0]!.subject).toContain(`Payment received for ${o.number}`);
    expect(receipts()[0]!.text).toContain(`QK${stamp.toUpperCase()}${n}`);
    // The warehouse still hears about it, once.
    expect(sent.filter((m) => m.to === "orders@example.test")).toHaveLength(1);
    expect(await prisma.orderEvent.count({ where: { orderId: o.id, type: "receipt_sent" } })).toBe(1);
  });

  it("sends one receipt when the callback and several polls report the payment at the same moment", async () => {
    const o = await order("PAID", new Date());
    await Promise.all([mod.sendReceiptOnce({ number: o.number }), mod.sendReceiptOnce({ id: o.id }), mod.notifyIfPaid({ outcome: "APPLIED", orderNumber: o.number })]);
    expect(receipts()).toHaveLength(1);
  });

  it("stays quiet about a payment from days ago, so old orders get no surprise receipt", async () => {
    const o = await order("PAID", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));
    await mod.sendReceiptOnce({ id: o.id });
    expect(receipts()).toHaveLength(0);
  });

  it("sends nothing for an order that is not paid", async () => {
    const o = await order("PENDING_PAYMENT", null);
    await mod.notifyIfPaid({ outcome: "APPLIED", orderNumber: o.number });
    expect(receipts()).toHaveLength(0);
    expect(await prisma.orderEvent.count({ where: { orderId: o.id, type: "receipt_sent" } })).toBe(0);
  });
});
