import type { PaymentMethod, PrismaClient } from "@safuney/db";
import { CartService } from "@/lib/cart/service";
import { OrderError, type OrderService } from "@/lib/orders/service";
import { notifyOrderPlaced } from "@/lib/notify";
import { sendEmail } from "@/lib/email";

export class SubscriptionError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID",
    message: string,
  ) {
    super(message);
  }
}

export const INTERVALS = [7, 14, 28, 56] as const;
export const REMINDER_DAYS = 3;

export interface ScheduleInput {
  intervalDays: number;
  firstRunAt: Date;
  paymentMethod: PaymentMethod;
  addressId: string | null;
  items: Array<{ variantId: string; qty: number }>;
}

/**
 * Scheduled deliveries (master prompt Phase 4): a standing order that becomes a real order on each
 * run. Runs are idempotent per due date (one SubscriptionRun per run), the customer is reminded three
 * days ahead, and a run that cannot be placed (stock, credit) is recorded and emailed, never retried
 * silently.
 */
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly orders: OrderService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async customerFor(userId: string) {
    const m = await this.prisma.customerMember.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, include: { customer: { select: { id: true, type: true } } } });
    return m ?? null;
  }

  async listFor(userId: string) {
    const m = await this.customerFor(userId);
    if (!m) return [];
    const list = await this.prisma.subscription.findMany({ where: { customerId: m.customerId }, orderBy: { nextRunAt: "asc" }, include: { items: { include: { variant: { include: { product: { select: { name: true } } } } } }, runs: { orderBy: { ranAt: "desc" }, take: 3, include: { order: { select: { number: true, accessToken: true, status: true } } } } } });
    const addressIds = list.map((s) => s.addressId).filter((x): x is string => Boolean(x));
    const addresses = addressIds.length ? await this.prisma.address.findMany({ where: { id: { in: addressIds } } }) : [];
    return list.map((s) => ({ ...s, address: addresses.find((a) => a.id === s.addressId) ?? null }));
  }

  async create(userId: string, input: ScheduleInput) {
    let m = await this.customerFor(userId);
    if (!m) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, phone: true } });
      const c = await this.prisma.customer.create({ data: { type: "INDIVIDUAL", displayName: user.name ?? user.email ?? user.phone ?? "Customer", members: { create: { userId, role: "OWNER" } } } });
      m = { customerId: c.id, customer: { id: c.id, type: "INDIVIDUAL" } } as NonNullable<typeof m>;
    }
    if (!INTERVALS.includes(input.intervalDays as (typeof INTERVALS)[number])) throw new SubscriptionError("INVALID", "Choose every week, two weeks, four weeks or eight weeks.");
    if (input.items.length === 0) throw new SubscriptionError("INVALID", "Add at least one pack to the schedule.");
    if (input.firstRunAt.getTime() < this.now().getTime() - 86_400_000) throw new SubscriptionError("INVALID", "The first delivery must be today or later.");
    if (input.paymentMethod === "INVOICE") {
      const c = await this.prisma.customer.findUniqueOrThrow({ where: { id: m.customerId } });
      if (c.status !== "CREDIT_APPROVED") throw new SubscriptionError("INVALID", "Invoice payment is for approved credit accounts. Choose another method.");
    }
    return this.prisma.subscription.create({ data: { customerId: m.customerId, intervalDays: input.intervalDays, nextRunAt: input.firstRunAt, paymentMethod: input.paymentMethod, addressId: input.addressId, items: { create: input.items.map((i) => ({ variantId: i.variantId, qty: Math.min(999, Math.max(1, Math.floor(i.qty))) })) } } });
  }

  private async owned(userId: string, id: string) {
    const s = await this.prisma.subscription.findUnique({ where: { id }, include: { customer: { include: { members: { where: { userId } } } } } });
    if (!s) throw new SubscriptionError("NOT_FOUND", "Schedule not found.");
    if (s.customer.members.length === 0) throw new SubscriptionError("FORBIDDEN", "That schedule belongs to another account.");
    return s;
  }

  async setStatus(userId: string, id: string, status: "ACTIVE" | "PAUSED" | "CANCELLED") {
    const s = await this.owned(userId, id);
    if (s.status === "CANCELLED") throw new SubscriptionError("INVALID", "A cancelled schedule cannot be restarted; create a new one.");
    const data: { status: typeof status; nextRunAt?: Date } = { status };
    // Resuming a schedule whose date has passed starts from the next interval, not from the past.
    if (status === "ACTIVE" && s.nextRunAt.getTime() < this.now().getTime()) data.nextRunAt = new Date(this.now().getTime() + s.intervalDays * 86_400_000);
    return this.prisma.subscription.update({ where: { id }, data });
  }

  async skipNext(userId: string, id: string) {
    const s = await this.owned(userId, id);
    return this.prisma.subscription.update({ where: { id }, data: { nextRunAt: new Date(s.nextRunAt.getTime() + s.intervalDays * 86_400_000), reminderSentAt: null } });
  }

  /** Cron: remind three days ahead, then place the due orders. Returns what happened for the log. */
  async runDue(baseUrl: string): Promise<{ reminded: number; placed: number; failed: number }> {
    const now = this.now();
    let reminded = 0;
    const toRemind = await this.prisma.subscription.findMany({ where: { status: "ACTIVE", reminderSentAt: null, nextRunAt: { lte: new Date(now.getTime() + REMINDER_DAYS * 86_400_000) } }, include: { customer: { include: { members: { where: { role: "OWNER" }, include: { user: true }, take: 1 } } }, items: { include: { variant: { include: { product: { select: { name: true } } } } } } } });
    for (const s of toRemind) {
      const owner = s.customer.members[0]?.user;
      if (owner?.email) {
        await sendEmail({ to: owner.email, subject: `Your Safuney delivery is scheduled for ${s.nextRunAt.toDateString()}`, text: `We will place your scheduled order on ${s.nextRunAt.toDateString()}:\n\n${s.items.map((i) => `- ${i.variant.product.name} ${i.variant.packLabel} × ${i.qty}`).join("\n")}\n\nTo change or skip it: ${baseUrl}/account/deliveries` });
      }
      await this.prisma.subscription.update({ where: { id: s.id }, data: { reminderSentAt: now } });
      reminded++;
    }

    let placed = 0;
    let failed = 0;
    const due = await this.prisma.subscription.findMany({ where: { status: "ACTIVE", nextRunAt: { lte: now } }, include: { customer: { include: { members: { where: { role: "OWNER" }, include: { user: true }, take: 1 } } }, items: true } });
    for (const s of due) {
      const owner = s.customer.members[0];
      const address = s.addressId ? await this.prisma.address.findUnique({ where: { id: s.addressId } }) : null;
      const carts = new CartService(this.prisma);
      try {
        const cart = await carts.getOrCreate(undefined);
        for (const i of s.items) await carts.add(cart.token, i.variantId, i.qty);
        const contact = { name: owner?.user.name ?? s.customer.displayName, email: owner?.user.email ?? "", phone: address?.phone ?? owner?.user.phone ?? "" };
        if (!contact.email && !contact.phone) throw new SubscriptionError("INVALID", "No contact details on the account.");
        const result = await this.orders.placeOrder({
          cartToken: cart.token,
          contact,
          delivery: address ? { method: "DELIVERY", county: address.county, town: address.town, line1: address.line1 ?? undefined, landmark: address.landmark ?? undefined, deliveryNotes: address.deliveryNotes ?? undefined, recipientName: address.recipientName, recipientPhone: address.phone } : { method: "PICKUP" },
          paymentMethod: s.paymentMethod,
          userId: owner?.userId,
          customerId: s.customerId,
          placedByRole: "OWNER",
          notes: "Scheduled delivery",
          baseUrl,
        });
        await this.prisma.$transaction([
          this.prisma.subscriptionRun.create({ data: { subscriptionId: s.id, orderId: result.orderId, status: "CREATED" } }),
          this.prisma.subscription.update({ where: { id: s.id }, data: { nextRunAt: new Date(s.nextRunAt.getTime() + s.intervalDays * 86_400_000), reminderSentAt: null } }),
        ]);
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: true } });
        await notifyOrderPlaced({ number: order.number, accessToken: order.accessToken, email: order.guestEmail, phone: order.guestPhone, totalMinorUnits: order.totalMinorUnits, paymentMethod: order.paymentMethod, status: order.status, baseUrl, items: order.items.map((i) => ({ name: i.name, packLabel: i.packLabel, qty: i.qty })) });
        placed++;
      } catch (e) {
        const message = e instanceof OrderError || e instanceof SubscriptionError ? e.message : "The order could not be placed.";
        await this.prisma.$transaction([
          this.prisma.subscriptionRun.create({ data: { subscriptionId: s.id, status: "FAILED", error: message } }),
          // Move on so the failure is not retried every ten minutes; the owner is told and can reorder by hand.
          this.prisma.subscription.update({ where: { id: s.id }, data: { nextRunAt: new Date(s.nextRunAt.getTime() + s.intervalDays * 86_400_000), reminderSentAt: null } }),
        ]);
        if (owner?.user.email) await sendEmail({ to: owner.user.email, subject: "Your scheduled Safuney order was not placed", text: `${message}\n\nPlace it by hand from ${baseUrl}/account/deliveries, or call +254 796 808 822.` });
        if (!(e instanceof OrderError) && !(e instanceof SubscriptionError)) console.error("scheduled delivery failed", e);
        failed++;
      }
    }
    return { reminded, placed, failed };
  }
}
