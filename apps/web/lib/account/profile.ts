import type { PrismaClient } from "@safuney/db";
import { normaliseKenyanMobile } from "@safuney/config";

export class ProfileError extends Error {
  constructor(
    public readonly code: "INVALID" | "TAKEN" | "STATE",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Profile, data export and deletion (Kenya Data Protection Act 2019: access, portability, erasure).
 * Deletion anonymises what tax law requires us to keep (orders, invoices) and removes the rest.
 */
export class ProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  async update(userId: string, input: { name: string; email: string; phone: string; marketingOptIn: boolean }) {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase() || null;
    const phone = input.phone.trim() ? normaliseKenyanMobile(input.phone) : null;
    if (input.phone.trim() && !phone) throw new ProfileError("INVALID", "That does not look like a Kenyan mobile number.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ProfileError("INVALID", "Enter a valid email address.");
    if (!email && !phone) throw new ProfileError("INVALID", "Keep at least an email address or a phone number so you can sign in.");
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (email && email !== current.email && (await this.prisma.user.findUnique({ where: { email } }))) throw new ProfileError("TAKEN", "That email address belongs to another account. Sign in with it instead, or call us to merge the two.");
    if (phone && phone !== current.phone && (await this.prisma.user.findUnique({ where: { phone } }))) throw new ProfileError("TAKEN", "That phone number belongs to another account. Sign in with it instead, or call us to merge the two.");
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          name: name || null,
          email,
          phone,
          // A changed contact is unverified until used to sign in.
          ...(email !== current.email ? { emailVerified: null } : {}),
          ...(phone !== current.phone ? { phoneVerified: null } : {}),
          marketingOptInAt: input.marketingOptIn ? (current.marketingOptInAt ?? new Date()) : null,
        },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: "profile.update", entity: "User", entityId: userId, before: { name: current.name, email: current.email, phone: current.phone, marketingOptInAt: current.marketingOptInAt?.toISOString() ?? null }, after: { name: u.name, email: u.email, phone: u.phone, marketingOptInAt: u.marketingOptInAt?.toISOString() ?? null } } });
      return u;
    });
  }

  /** Everything we hold about the person, as JSON (portability). */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true, createdAt: true, marketingOptInAt: true, role: true } });
    const memberships = await this.prisma.customerMember.findMany({ where: { userId }, include: { customer: { include: { addresses: true, savedLists: { include: { items: true } }, subscriptions: { include: { items: true } }, invoices: true, creditApplications: true } } } });
    const orders = await this.prisma.order.findMany({ where: { userId }, include: { items: true, events: true, payments: { select: { provider: true, status: true, amountMinorUnits: true, providerRef: true, createdAt: true } } } });
    const quotes = await this.prisma.quote.findMany({ where: { OR: [{ contactEmail: user.email ?? "" }, { customerId: { in: memberships.map((m) => m.customerId) } }] }, include: { items: true } });
    const reviews = await this.prisma.review.findMany({ where: { userId } });
    return JSON.parse(JSON.stringify({ exportedAt: new Date().toISOString(), user, memberships, orders, quotes, reviews }, (_k, v) => (typeof v === "bigint" ? v.toString() : v))) as unknown;
  }

  /**
   * Erasure: personal identifiers are removed or replaced; orders and invoices stay for tax records but
   * lose the name, email, phone and addresses. Organisation records are kept when other members remain.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { memberships: { include: { customer: { include: { members: true } } } } } });
    const open = await this.prisma.order.count({ where: { userId, status: { in: ["AWAITING_APPROVAL", "PENDING_PAYMENT", "PAID", "CONFIRMED", "PACKED", "DISPATCHED"] } } });
    if (open > 0) throw new ProfileError("STATE", `You have ${open} order${open === 1 ? "" : "s"} still in progress. Once they are delivered or cancelled, the account can be deleted.`);
    const anon = `deleted-${userId.slice(-8)}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.order.updateMany({ where: { userId }, data: { guestEmail: `${anon}@removed.invalid`, guestPhone: null, shippingAddress: { removed: true }, billingAddress: { removed: true }, notes: null } });
      await tx.review.deleteMany({ where: { userId } });
      for (const m of user.memberships) {
        const others = m.customer.members.filter((x) => x.userId !== userId);
        if (m.customer.type === "INDIVIDUAL" || others.length === 0) {
          await tx.subscription.updateMany({ where: { customerId: m.customerId }, data: { status: "CANCELLED" } });
          await tx.address.deleteMany({ where: { customerId: m.customerId } });
          await tx.savedList.deleteMany({ where: { customerId: m.customerId } });
          await tx.customer.update({ where: { id: m.customerId }, data: { displayName: "Deleted customer", legalName: null, kraPin: null, notes: null, status: "SUSPENDED" } });
        }
        await tx.customerMember.delete({ where: { id: m.id } });
      }
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.user.update({ where: { id: userId }, data: { name: null, email: `${anon}@removed.invalid`, phone: null, emailVerified: null, phoneVerified: null, image: null, passwordHash: null, totpSecret: null, isActive: false, marketingOptInAt: null } });
      await tx.auditLog.create({ data: { actorId: userId, action: "account.delete", entity: "User", entityId: userId, after: { anonymised: true } } });
    });
  }
}
