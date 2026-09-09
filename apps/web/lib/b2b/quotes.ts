import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@safuney/db";
import * as money from "@safuney/db/money";
import { CartService } from "@/lib/cart/service";
import type { OrderService, PlaceOrderResult, DeliveryInput } from "@/lib/orders/service";
import { sendEmail } from "@/lib/email";
import { config } from "@/lib/env";

export class QuoteError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "STATE",
    message: string,
  ) {
    super(message);
  }
}

export const QUOTE_VALID_DAYS = 14;

export interface QuoteRequestInput {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  organisation?: string;
  notes?: string;
  lines: Array<{ variantId?: string; description: string; qty: number }>;
  userId?: string;
  customerId?: string;
  source?: string;
}

/** QUO-YYYYMMDD-NNNN */
async function nextQuoteNumber(tx: Prisma.TransactionClient, now: Date): Promise<string> {
  const prefix = `QUO-${now.toISOString().slice(0, 10).replace(/-/g, "")}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('quote-number'))`;
  const last = await tx.quote.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } });
  return `${prefix}${String(last ? Number(last.number.slice(prefix.length)) + 1 : 1).padStart(4, "0")}`;
}

/**
 * Request-for-quote (master prompt Phase 4): the customer describes what they need (catalogue packs
 * or free text), sales prices it, the customer accepts from an emailed link and the quote becomes an
 * order at the quoted prices. Every status change is stamped; the quote is the audit record.
 */
export class QuoteService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly orders: OrderService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async request(input: QuoteRequestInput) {
    const lines = input.lines.filter((l) => l.description.trim() || l.variantId).map((l) => ({ ...l, description: l.description.trim(), qty: Math.max(1, Math.min(9999, Math.floor(l.qty || 1))) }));
    if (lines.length === 0) throw new QuoteError("INVALID", "Tell us at least one product or need.");
    if (input.contactName.trim().length < 2) throw new QuoteError("INVALID", "Enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail.trim())) throw new QuoteError("INVALID", "Enter the email address the quote should go to.");
    const now = this.now();
    const quote = await this.prisma.$transaction(async (tx) => {
      const number = await nextQuoteNumber(tx, now);
      const q = await tx.quote.create({
        data: {
          number,
          customerId: input.customerId ?? null,
          contactName: input.contactName.trim(),
          contactEmail: input.contactEmail.trim().toLowerCase(),
          contactPhone: input.contactPhone.trim(),
          notes: [input.organisation ? `Organisation: ${input.organisation.trim()}` : null, input.notes?.trim() || null].filter(Boolean).join("\n") || null,
          accessToken: randomBytes(18).toString("base64url"),
          items: { create: lines.map((l) => ({ variantId: l.variantId ?? null, description: l.description, qty: l.qty })) },
        },
        include: { items: true },
      });
      await tx.lead.create({ data: { kind: "QUOTE_REQUEST", name: q.contactName, email: q.contactEmail, phone: q.contactPhone, organisation: input.organisation?.trim() || null, message: `Quote ${q.number}: ${lines.map((l) => `${l.description} × ${l.qty}`).join("; ")}`, payload: { quoteId: q.id }, source: input.source ?? "/quote" } });
      return q;
    });
    await sendEmail({ to: config.leadsInbox, subject: `Quote request ${quote.number} from ${quote.contactName}`, text: `${quote.contactName} (${quote.contactEmail}, ${quote.contactPhone})\n\n${quote.items.map((i) => `- ${i.description} × ${i.qty}`).join("\n")}\n\n${quote.notes ?? ""}\n\nPrice it: ${config.siteUrl}/sales/quotes/${quote.id}` });
    await sendEmail({ to: quote.contactEmail, subject: `We have your quote request ${quote.number}`, text: `Thank you, ${quote.contactName}. We price quotes within one working day and email you a link to accept.\n\nWhat you asked for:\n${quote.items.map((i) => `- ${i.description} × ${i.qty}`).join("\n")}` });
    return quote;
  }

  /** The customer's view: by number and token, with expiry applied on read. */
  async open(number: string, accessToken: string) {
    const q = await this.prisma.quote.findUnique({ where: { number }, include: { items: { include: { variant: { include: { product: { select: { name: true } } } } } }, order: { select: { number: true, accessToken: true } } } });
    if (!q || q.accessToken !== accessToken) throw new QuoteError("NOT_FOUND", "Quote not found. Use the link from your email.");
    if (q.status === "PRICED" && q.validUntil && q.validUntil.getTime() < this.now().getTime()) {
      return this.prisma.quote.update({ where: { id: q.id }, data: { status: "EXPIRED" }, include: { items: { include: { variant: { include: { product: { select: { name: true } } } } } }, order: { select: { number: true, accessToken: true } } } });
    }
    return q;
  }

  private async assertSales(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
    if (!u || !u.isActive || !["SALES", "ADMIN"].includes(u.role)) throw new QuoteError("FORBIDDEN", "Only sales staff can price quotes.");
  }

  async listForSales(userId: string) {
    await this.assertSales(userId);
    return this.prisma.quote.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100, include: { items: true, customer: { select: { displayName: true } } } });
  }

  async getForSales(userId: string, id: string) {
    await this.assertSales(userId);
    const q = await this.prisma.quote.findUnique({ where: { id }, include: { items: { include: { variant: { include: { product: { select: { name: true } } } } } }, customer: { select: { displayName: true, priceListId: true } }, order: { select: { number: true } } } });
    if (!q) throw new QuoteError("NOT_FOUND", "Quote not found.");
    return q;
  }

  /**
   * Sales prices every line (each must be attached to a catalogue pack so acceptance can become an
   * order), sets validity and sends the link. Re-pricing an open quote is allowed until it is accepted.
   */
  async price(userId: string, id: string, input: { lines: Array<{ itemId: string; variantId: string; unitPriceMinorUnits: bigint; qty: number }>; validDays?: number; salesNote?: string }) {
    await this.assertSales(userId);
    const q = await this.prisma.quote.findUnique({ where: { id }, include: { items: true } });
    if (!q) throw new QuoteError("NOT_FOUND", "Quote not found.");
    if (!["REQUESTED", "PRICED", "EXPIRED"].includes(q.status)) throw new QuoteError("STATE", `This quote is ${q.status.toLowerCase()} and cannot be re-priced.`);
    if (input.lines.length !== q.items.length) throw new QuoteError("INVALID", "Price every line, or remove the ones we cannot supply.");
    for (const l of input.lines) {
      if (!q.items.some((i) => i.id === l.itemId)) throw new QuoteError("INVALID", "A line does not belong to this quote.");
      if (l.unitPriceMinorUnits <= 0n) throw new QuoteError("INVALID", "Every line needs a unit price above zero.");
      if (l.qty < 1) throw new QuoteError("INVALID", "Every line needs a quantity of at least one.");
      const v = await this.prisma.productVariant.findUnique({ where: { id: l.variantId }, select: { id: true, isActive: true } });
      if (!v || !v.isActive) throw new QuoteError("INVALID", "Attach each line to an active catalogue pack (by SKU).");
    }
    const validUntil = new Date(this.now().getTime() + (input.validDays ?? QUOTE_VALID_DAYS) * 86_400_000);
    const priced = await this.prisma.$transaction(async (tx) => {
      for (const l of input.lines) await tx.quoteItem.update({ where: { id: l.itemId }, data: { variantId: l.variantId, unitPriceMinorUnits: l.unitPriceMinorUnits, qty: l.qty } });
      const updated = await tx.quote.update({ where: { id }, data: { status: "PRICED", pricedById: userId, pricedAt: this.now(), validUntil, salesNote: input.salesNote?.trim() || null }, include: { items: { include: { variant: { include: { product: { select: { name: true } } } } } } } });
      await tx.auditLog.create({ data: { actorId: userId, action: "quote.price", entity: "Quote", entityId: id, after: { lines: input.lines.map((l) => ({ itemId: l.itemId, variantId: l.variantId, unitPriceMinorUnits: l.unitPriceMinorUnits.toString(), qty: l.qty })), validUntil: validUntil.toISOString() } } });
      return updated;
    });
    const total = priced.items.reduce((s, i) => s + money.times(i.unitPriceMinorUnits!, i.qty) + money.vatOn(money.times(i.unitPriceMinorUnits!, i.qty), i.vatRateBps), 0n);
    await sendEmail({ to: priced.contactEmail, subject: `Your Safuney quote ${priced.number}: ${money.formatKes(total)} incl. VAT`, text: `${priced.salesNote ? `${priced.salesNote}\n\n` : ""}${priced.items.map((i) => `- ${i.variant?.product.name ?? i.description} ${i.variant?.packLabel ?? ""} × ${i.qty} at ${money.formatKes(i.unitPriceMinorUnits!)} ex VAT`).join("\n")}\n\nTotal ${money.formatKes(total)} incl. VAT, valid until ${validUntil.toDateString()}.\n\nAccept or decline: ${config.siteUrl}/quotes/${priced.number}?token=${priced.accessToken}` });
    return priced;
  }

  /** Acceptance converts the quote into an order at the quoted prices through the same order service. */
  async accept(number: string, accessToken: string, input: { delivery: DeliveryInput; paymentMethod: "MPESA" | "CARD" | "COD" | "INVOICE"; poNumber?: string; userId?: string; baseUrl: string }): Promise<PlaceOrderResult> {
    const q = await this.open(number, accessToken);
    if (q.status !== "PRICED") throw new QuoteError("STATE", q.status === "EXPIRED" ? "This quote has expired. Ask us to refresh it." : q.status === "CONVERTED" || q.status === "ACCEPTED" ? "This quote has already been accepted." : "This quote is not ready to accept yet.");
    if (q.items.some((i) => !i.variantId || i.unitPriceMinorUnits === null)) throw new QuoteError("STATE", "This quote has a line we still need to attach to a pack. Call us and we will fix it.");

    // A quote link is shareable, so whoever opens it is not necessarily a member of the organisation it
    // was quoted to. The order is only attached to that organisation when the person accepting is
    // signed in as one of its members, with their own role: otherwise a forwarded link would draw on
    // the credit line and skip the approval threshold that the same person faces at checkout.
    const membership = input.userId && q.customerId ? await this.prisma.customerMember.findUnique({ where: { customerId_userId: { customerId: q.customerId, userId: input.userId } } }) : null;
    const customerId = membership ? q.customerId! : undefined;
    const placedByRole = membership?.role;
    if (input.paymentMethod === "INVOICE" && !customerId) {
      throw new QuoteError("FORBIDDEN", "Sign in with your organisation account to accept this quote on invoice, or choose another way to pay.");
    }

    await this.prisma.$transaction([
      this.prisma.quote.update({ where: { id: q.id }, data: { status: "ACCEPTED", acceptedAt: this.now() } }),
      this.prisma.auditLog.create({ data: { actorId: input.userId ?? null, action: "quote.accept", entity: "Quote", entityId: q.id, after: { paymentMethod: input.paymentMethod } } }),
    ]);
    const carts = new CartService(this.prisma);
    const cart = await carts.getOrCreate(undefined);
    try {
      for (const i of q.items) await carts.add(cart.token, i.variantId!, i.qty);
      const result = await this.orders.placeOrder({ cartToken: cart.token, contact: { name: q.contactName, email: q.contactEmail, phone: q.contactPhone }, delivery: input.delivery, paymentMethod: input.paymentMethod, poNumber: input.poNumber, notes: `Quote ${q.number}`, userId: input.userId, customerId, placedByRole, quoteId: q.id, baseUrl: input.baseUrl });
      await this.prisma.quote.update({ where: { id: q.id }, data: { status: "CONVERTED", orderId: result.orderId } });
      return result;
    } catch (e) {
      // Acceptance stands but the order could not be placed (stock, delivery): back to PRICED so it can be tried again.
      await this.prisma.quote.update({ where: { id: q.id }, data: { status: "PRICED", acceptedAt: null } });
      await this.prisma.cart.deleteMany({ where: { token: cart.token } });
      throw e;
    }
  }

  async decline(number: string, accessToken: string, reason?: string) {
    const q = await this.open(number, accessToken);
    if (q.status !== "PRICED" && q.status !== "REQUESTED") throw new QuoteError("STATE", "This quote can no longer be declined.");
    await this.prisma.$transaction([
      this.prisma.quote.update({ where: { id: q.id }, data: { status: "DECLINED" } }),
      this.prisma.auditLog.create({ data: { action: "quote.decline", entity: "Quote", entityId: q.id, after: { reason: reason?.trim() || null } } }),
    ]);
  }
}
