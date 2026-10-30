import type { PrismaClient } from "@safuney/db";

const STAFF = new Set(["SALES", "WAREHOUSE", "FINANCE", "ADMIN"]);

/**
 * Attaches orders placed as a guest to the account that has since signed in with the same email or
 * phone, so a customer finds their history under Account rather than only in tracking links.
 *
 * Only a verified contact counts: emailVerified/phoneVerified are set by a sign-in link or code, and
 * cleared when the contact is changed in the profile (ProfileService.update), so typing someone
 * else's address into a profile cannot collect their orders. Staff accounts are left out: they sign
 * in with a password, which proves nothing about the mailbox. Returns how many orders were attached.
 */
export async function claimGuestOrders(prisma: PrismaClient, userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true, emailVerified: true, phone: true, phoneVerified: true } });
  if (!user || STAFF.has(user.role)) return 0;
  const matches = [
    ...(user.email && user.emailVerified ? [{ guestEmail: { equals: user.email, mode: "insensitive" as const } }] : []),
    ...(user.phone && user.phoneVerified ? [{ guestPhone: user.phone }] : []),
  ];
  if (matches.length === 0) return 0;
  const { count } = await prisma.order.updateMany({ where: { userId: null, OR: matches }, data: { userId } });
  return count;
}
