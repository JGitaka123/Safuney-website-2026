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

  /**
   * Name and marketing choice. Email and phone are not changed here: a new one is added only once a
   * code sent to it is entered (see confirmContact), so nobody can put someone else's number on their
   * account and have that person's sign-ins land in it.
   */
  async update(userId: string, input: { name: string; marketingOptIn: boolean }) {
    const name = input.name.trim();
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { name: name || null, marketingOptInAt: input.marketingOptIn ? (current.marketingOptInAt ?? new Date()) : null },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: "profile.update", entity: "User", entityId: userId, before: { name: current.name, marketingOptInAt: current.marketingOptInAt?.toISOString() ?? null }, after: { name: u.name, marketingOptInAt: u.marketingOptInAt?.toISOString() ?? null } } });
      return u;
    });
  }

  /** Checks a contact typed into the profile; returns the sign-in identifier ("email:…" / "phone:…"). */
  static parseContact(kind: "email" | "phone", raw: string): string {
    if (kind === "email") {
      const email = raw.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ProfileError("INVALID", "Enter a valid email address.");
      return `email:${email}`;
    }
    const phone = raw.trim() ? normaliseKenyanMobile(raw) : null;
    if (!phone) throw new ProfileError("INVALID", "That does not look like a Kenyan mobile number. Use 07xx xxx xxx or 01xx xxx xxx.");
    return `phone:${phone.startsWith("+") ? phone : `+254${phone.replace(/^0/, "")}`}`;
  }

  /** Takes an email or phone off the account. One must remain so the customer can still sign in. */
  async removeContact(userId: string, kind: "email" | "phone") {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const other = kind === "email" ? current.phone : current.email;
    if (!other) throw new ProfileError("INVALID", "Keep at least an email address or a phone number so you can sign in.");
    if (kind === "email" && current.passwordHash) throw new ProfileError("INVALID", "Staff sign in with this email address, so it cannot be removed here.");
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: kind === "email" ? { email: null, emailVerified: null } : { phone: null, phoneVerified: null } });
      await tx.auditLog.create({ data: { actorId: userId, action: "profile.contact.remove", entity: "User", entityId: userId, before: { [kind]: current[kind] }, after: { [kind]: null } } });
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
