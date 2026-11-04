import type { PrismaClient } from "@safuney/db";
import { otpIdentifierForEmail, otpIdentifierForPhone, verifyOtp } from "./otp";

const STAFF_ROLES = new Set(["SALES", "WAREHOUSE", "FINANCE", "ADMIN"]);

export function isStaffRole(role: string | null | undefined): boolean {
  return Boolean(role && STAFF_ROLES.has(role));
}

/**
 * Whether an email or phone identifier ("email:…" / "phone:…") belongs to a staff account.
 *
 * Customer sign-in (emailed link, emailed or texted code) proves only that someone can read that
 * mailbox or phone. A staff account needs its password and authenticator code as well, so these
 * methods must never open one: otherwise anyone with access to a staff mailbox is an administrator.
 */
export async function isStaffContact(prisma: PrismaClient, identifier: string): Promise<boolean> {
  const [kind, value] = identifier.split(":", 2) as ["phone" | "email", string];
  if (!value) return false;
  const user = await prisma.user.findUnique({ where: kind === "phone" ? { phone: value } : { email: value }, select: { role: true } });
  return isStaffRole(user?.role);
}

/**
 * Checks a one-time code and returns the customer account it opens, creating one on first sign-in.
 * Null for a wrong or expired code, a switched-off account, or a staff account.
 */
export async function customerFromCode(prisma: PrismaClient, target: string, code: string) {
  const identifier = target.includes("@") ? otpIdentifierForEmail(target) : otpIdentifierForPhone(target);
  if (!identifier || !/^\d{6}$/.test(code)) return null;
  // Checked before the code is spent or the contact marked verified, so a staff account is left as it was.
  if (await isStaffContact(prisma, identifier)) return null;
  const v = await verifyOtp(identifier, code);
  if (!v.ok) return null;
  const [kind, value] = identifier.split(":", 2) as ["phone" | "email", string];
  const now = new Date();
  const user =
    kind === "phone"
      ? await prisma.user.upsert({ where: { phone: value }, create: { phone: value, phoneVerified: now }, update: { phoneVerified: now } })
      : await prisma.user.upsert({ where: { email: value }, create: { email: value, emailVerified: now }, update: { emailVerified: now } });
  // A staff role granted between the check above and now still does not open here.
  if (!user.isActive || isStaffRole(user.role)) return null;
  return user;
}
