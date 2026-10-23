import type { PrismaClient } from "@safuney/db";
import { hashPassword, verifyPassword, verifyTotp } from "./password";

/** A refusal the person can act on; the message is shown as is. */
export class SecurityError extends Error {}

const STAFF_ROLES = new Set(["SALES", "WAREHOUSE", "FINANCE", "ADMIN"]);
const NOT_RECOGNISED = "Current password or authenticator code not recognised.";
const BASE32_KEY = /^[A-Z2-7]{16,}$/;

/**
 * Staff changing their own password or authenticator. Both need the current password and, once one is
 * set up, a code from the current authenticator: an unattended signed-in screen must not be enough to
 * take the account. Either change stamps credentialsChangedAt, which ends every session signed in
 * before it (lib/auth/session.ts), including the one making the change.
 */
export class StaffSecurityService {
  constructor(private readonly prisma: PrismaClient) {}

  private async proveIdentity(userId: string, currentPassword: string, currentCode: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true, passwordHash: true, totpSecret: true } });
    if (!user || !user.isActive || !STAFF_ROLES.has(user.role)) throw new SecurityError("This page is for staff accounts.");
    if (!verifyPassword(currentPassword.trim(), user.passwordHash)) throw new SecurityError(NOT_RECOGNISED);
    if (user.totpSecret && !verifyTotp(user.totpSecret, currentCode)) throw new SecurityError(NOT_RECOGNISED);
    return user;
  }

  async changePassword(userId: string, input: { currentPassword: string; currentCode: string; newPassword: string; confirmPassword: string }): Promise<void> {
    // Trimmed as staff sign-in trims (auth.ts), so what is saved is what will be accepted.
    const next = input.newPassword.trim();
    if (next.length < 12) throw new SecurityError("Use at least 12 characters for the new password.");
    if (next !== input.confirmPassword.trim()) throw new SecurityError("The two new passwords are different. Type the same one in both boxes.");
    const user = await this.proveIdentity(userId, input.currentPassword, input.currentCode);
    if (verifyPassword(next, user.passwordHash)) throw new SecurityError("The new password is the same as the current one.");
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next), credentialsChangedAt: new Date() } });
      // Neither password goes in the log.
      await tx.auditLog.create({ data: { actorId: user.id, action: "staff.password.change", entity: "User", entityId: user.id } });
    });
  }

  /**
   * Moves the account to a new authenticator key. The key is generated on the page and comes back with
   * the form; a code from it proves it reached the phone before the old one stops working.
   */
  async changeAuthenticator(userId: string, input: { currentPassword: string; currentCode: string; newKey: string; newCode: string }): Promise<void> {
    const key = input.newKey.replace(/\s+/g, "").toUpperCase();
    if (!BASE32_KEY.test(key)) throw new SecurityError("The new key is missing or damaged. Reload the page to get a fresh one.");
    const user = await this.proveIdentity(userId, input.currentPassword, input.currentCode);
    if (!verifyTotp(key, input.newCode)) throw new SecurityError("The code from the new entry does not match. Check the key was typed into the app exactly, then try the next code.");
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { totpSecret: key, credentialsChangedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "staff.totp.change", entity: "User", entityId: user.id } });
    });
  }
}
