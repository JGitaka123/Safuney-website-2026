import type { MemberRole, Prisma, PrismaClient, UserRole } from "@safuney/db";
import { ProfileError } from "./profile";

/** Roles a customer account can have; anything else is staff and is never merged. */
const CUSTOMER_ROLES: UserRole[] = ["CUSTOMER", "B2B_BUYER", "B2B_APPROVER"];
const ROLE_RANK: Record<string, number> = { CUSTOMER: 0, B2B_BUYER: 1, B2B_APPROVER: 2 };
const MEMBER_RANK: Record<MemberRole, number> = { BUYER: 0, APPROVER: 1, OWNER: 2 };

export type ContactKind = "email" | "phone";

export interface ConfirmResult {
  /** True when another customer account held this contact and was folded into this one. */
  merged: boolean;
}

/**
 * Puts a contact the customer has just proved (with a code sent to it) on their account.
 *
 * If the contact already belongs to another customer account, that account is merged into this one:
 * the code proves the person reads that mailbox or phone, and the session proves they hold this
 * account, so the two are the same customer. Orders, addresses, lists, carts and organisations move
 * across; the other account is switched off and loses its contacts. Staff accounts are never merged
 * either way, and a switched-off account is left for staff to sort out.
 */
export async function confirmContact(prisma: PrismaClient, userId: string, kind: ContactKind, value: string): Promise<ConfirmResult> {
  const now = new Date();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const other = await prisma.user.findUnique({ where: kind === "email" ? { email: value } : { phone: value } });

  if (!other || other.id === me.id) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: me.id }, data: kind === "email" ? { email: value, emailVerified: now } : { phone: value, phoneVerified: now } });
      await tx.auditLog.create({ data: { actorId: me.id, action: "profile.contact.confirm", entity: "User", entityId: me.id, before: { [kind]: me[kind] }, after: { [kind]: value } } });
    });
    return { merged: false };
  }

  const label = kind === "email" ? "email address" : "phone number";
  if (!CUSTOMER_ROLES.includes(me.role) || !CUSTOMER_ROLES.includes(other.role)) {
    throw new ProfileError("TAKEN", `That ${label} is used by a staff account, so it cannot be added here. Call us if it should be yours.`);
  }
  if (!other.isActive) throw new ProfileError("TAKEN", `That ${label} belongs to an account that is switched off. Call us and we will sort it out.`);

  await prisma.$transaction((tx) => mergeInto(tx, other.id, me.id, { kind, value }, now), { timeout: 30_000 });
  return { merged: true };
}

/**
 * Moves everything a customer account owns from `fromId` to `intoId`, then switches `fromId` off.
 * `confirmed` is the contact just proven; it replaces whatever `intoId` had of that kind.
 */
async function mergeInto(tx: Prisma.TransactionClient, fromId: string, intoId: string, confirmed: { kind: ContactKind; value: string }, now: Date): Promise<void> {
  const from = await tx.user.findUniqueOrThrow({ where: { id: fromId }, include: { memberships: { include: { customer: { include: { members: true } } } } } });
  const into = await tx.user.findUniqueOrThrow({ where: { id: intoId }, include: { memberships: { include: { customer: { include: { members: true } } } } } });

  // Each person has one personal (INDIVIDUAL) customer record holding their addresses, lists and invoices.
  const personal = (u: typeof from) => u.memberships.find((m) => m.customer.type === "INDIVIDUAL" && m.customer.members.length === 1);
  const fromPersonal = personal(from);
  const intoPersonal = personal(into);

  for (const m of from.memberships) {
    if (fromPersonal && intoPersonal && m.id === fromPersonal.id) {
      await moveCustomerRecords(tx, fromPersonal.customerId, intoPersonal.customerId);
      await tx.customer.update({ where: { id: fromPersonal.customerId }, data: { displayName: "Merged customer", status: "SUSPENDED", billingAddressId: null, notes: `Merged into ${intoPersonal.customerId}` } });
      await tx.customerMember.delete({ where: { id: m.id } });
      continue;
    }
    const mine = into.memberships.find((x) => x.customerId === m.customerId);
    if (!mine) {
      await tx.customerMember.update({ where: { id: m.id }, data: { userId: intoId } });
      continue;
    }
    // Both were members of the same organisation: keep the stronger role.
    if (MEMBER_RANK[m.role] > MEMBER_RANK[mine.role]) await tx.customerMember.update({ where: { id: mine.id }, data: { role: m.role } });
    await tx.customerMember.delete({ where: { id: m.id } });
  }

  await tx.order.updateMany({ where: { userId: fromId }, data: { userId: intoId } });
  await tx.cart.updateMany({ where: { userId: fromId }, data: { userId: intoId } });
  // One review per product per person: where both reviewed the same product, this account's stays.
  const reviewed = await tx.review.findMany({ where: { userId: intoId }, select: { productId: true } });
  await tx.review.deleteMany({ where: { userId: fromId, productId: { in: reviewed.map((r) => r.productId) } } });
  await tx.review.updateMany({ where: { userId: fromId }, data: { userId: intoId } });
  await tx.session.deleteMany({ where: { userId: fromId } });
  await tx.account.deleteMany({ where: { userId: fromId } });

  // Contacts: the one just proven goes on this account; of the other kind, this account keeps its own or
  // takes a verified one it lacks. The old account is cleared first (both are unique).
  const take = {
    ...(!into.email && from.email && from.emailVerified ? { email: from.email, emailVerified: from.emailVerified } : {}),
    ...(!into.phone && from.phone && from.phoneVerified ? { phone: from.phone, phoneVerified: from.phoneVerified } : {}),
    ...(confirmed.kind === "email" ? { email: confirmed.value, emailVerified: now } : { phone: confirmed.value, phoneVerified: now }),
  };
  await tx.user.update({ where: { id: fromId }, data: { name: null, email: null, phone: null, emailVerified: null, phoneVerified: null, isActive: false, marketingOptInAt: null } });
  await tx.user.update({
    where: { id: intoId },
    data: {
      ...take,
      name: into.name ?? from.name,
      role: (ROLE_RANK[from.role] ?? 0) > (ROLE_RANK[into.role] ?? 0) ? from.role : into.role,
    },
  });
  await tx.auditLog.create({
    data: { actorId: intoId, action: "account.merge", entity: "User", entityId: intoId, before: { mergedUserId: fromId, email: from.email, phone: from.phone }, after: { email: take.email ?? into.email, phone: take.phone ?? into.phone, at: now.toISOString() } },
  });
}

/** Re-points every row of one personal customer record at another. */
async function moveCustomerRecords(tx: Prisma.TransactionClient, fromCustomerId: string, intoCustomerId: string): Promise<void> {
  const where = { customerId: fromCustomerId };
  const data = { customerId: intoCustomerId };
  // A document subscription is unique per customer: drop the ones the other record already has.
  const subscribed = await tx.documentSubscription.findMany({ where: { customerId: intoCustomerId }, select: { documentId: true } });
  await tx.documentSubscription.deleteMany({ where: { customerId: fromCustomerId, documentId: { in: subscribed.map((s) => s.documentId) } } });
  await tx.documentSubscription.updateMany({ where, data });
  // Only one default address per customer: if this record has one, the moved ones join as ordinary addresses.
  if (await tx.address.count({ where: { customerId: intoCustomerId, isDefault: true } })) await tx.address.updateMany({ where, data: { isDefault: false } });
  await tx.address.updateMany({ where, data });
  await tx.order.updateMany({ where, data });
  await tx.invoice.updateMany({ where, data });
  await tx.quote.updateMany({ where, data });
  await tx.savedList.updateMany({ where, data });
  await tx.wishlist.updateMany({ where, data });
  await tx.subscription.updateMany({ where, data });
  await tx.cart.updateMany({ where, data });
  await tx.creditApplication.updateMany({ where, data });
  await tx.repVisit.updateMany({ where, data });
}
