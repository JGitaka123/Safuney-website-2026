/**
 * Staff changing their own password or authenticator, and the rule that a change ends sessions signed
 * in before it. The service tests need a database (CI provides one); the session rule does not.
 */
import * as OTPAuth from "otpauth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { sessionPredatesCredentials } from "@/lib/auth/session-age";
import { hashPassword, newTotpSecret, verifyPassword } from "@/lib/auth/password";
import { SecurityError, StaffSecurityService } from "@/lib/auth/staff-security";

function codeFor(secret: string): string {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 }).generate();
}

describe("a credential change ends older sessions", () => {
  const changed = new Date("2026-10-23T09:00:00.500Z");

  it("leaves every session alone on an account that has never changed", () => {
    expect(sessionPredatesCredentials(0, null)).toBe(false);
  });

  it("refuses a session signed in before the change, and one with no sign-in time", () => {
    expect(sessionPredatesCredentials(changed.getTime() - 60_000, changed)).toBe(true);
    expect(sessionPredatesCredentials(undefined, changed)).toBe(true);
  });

  it("accepts a session signed in after the change, or within the same second", () => {
    expect(sessionPredatesCredentials(changed.getTime() + 60_000, changed)).toBe(false);
    expect(sessionPredatesCredentials(changed.getTime() - 400, changed)).toBe(false);
  });
});

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("staff security", () => {
  let prisma: PrismaClient;
  let service: StaffSecurityService;
  const stamp = Date.now().toString(36);
  const ids: string[] = [];
  const PASSWORD = "correct horse battery";
  let secret: string;

  async function staff(): Promise<string> {
    secret = newTotpSecret();
    const u = await prisma.user.create({ data: { email: `sec-${ids.length}-${stamp}@example.test`, role: "SALES", passwordHash: hashPassword(PASSWORD), totpSecret: secret } });
    ids.push(u.id);
    return u.id;
  }

  async function refused(p: Promise<void>, message: RegExp) {
    await expect(p).rejects.toBeInstanceOf(SecurityError);
    await expect(p).rejects.toThrow(message);
  }

  beforeAll(() => {
    prisma = createTestClient(url!);
    service = new StaffSecurityService(prisma);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("changes the password, stamps the change and logs it without the password", async () => {
    const id = await staff();
    await service.changePassword(id, { currentPassword: PASSWORD, currentCode: codeFor(secret), newPassword: "  a brand new passphrase ", confirmPassword: "a brand new passphrase" });
    const u = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(verifyPassword("a brand new passphrase", u.passwordHash)).toBe(true);
    expect(verifyPassword(PASSWORD, u.passwordHash)).toBe(false);
    expect(u.credentialsChangedAt).not.toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { actorId: id, action: "staff.password.change" } });
    expect(JSON.stringify(log)).not.toContain("passphrase");
  });

  it("refuses without the current password or the current code, and changes nothing", async () => {
    const id = await staff();
    const good = { currentPassword: PASSWORD, currentCode: codeFor(secret), newPassword: "another long password", confirmPassword: "another long password" };
    await refused(service.changePassword(id, { ...good, currentPassword: "wrong password" }), /not recognised/);
    await refused(service.changePassword(id, { ...good, currentCode: "000000" === good.currentCode ? "111111" : "000000" }), /not recognised/);
    const u = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(verifyPassword(PASSWORD, u.passwordHash)).toBe(true);
    expect(u.credentialsChangedAt).toBeNull();
  });

  it("refuses a short, mismatched or unchanged new password", async () => {
    const id = await staff();
    const base = { currentPassword: PASSWORD, currentCode: codeFor(secret) };
    await refused(service.changePassword(id, { ...base, newPassword: "short", confirmPassword: "short" }), /12 characters/);
    await refused(service.changePassword(id, { ...base, newPassword: "a long new password", confirmPassword: "a long new passw0rd" }), /different/);
    await refused(service.changePassword(id, { ...base, newPassword: PASSWORD, confirmPassword: PASSWORD }), /same as the current/);
  });

  it("is for staff only", async () => {
    const u = await prisma.user.create({ data: { email: `sec-customer-${stamp}@example.test`, role: "CUSTOMER" } });
    ids.push(u.id);
    await refused(service.changePassword(u.id, { currentPassword: "", currentCode: "", newPassword: "a long new password", confirmPassword: "a long new password" }), /staff accounts/);
  });

  it("moves to a new authenticator only with a code from the new key", async () => {
    const id = await staff();
    const old = secret;
    const next = newTotpSecret();
    await refused(service.changeAuthenticator(id, { currentPassword: PASSWORD, currentCode: codeFor(old), newKey: next, newCode: codeFor(old) === codeFor(next) ? "000000" : codeFor(old) }), /does not match/);
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).totpSecret).toBe(old);

    await service.changeAuthenticator(id, { currentPassword: PASSWORD, currentCode: codeFor(old), newKey: next.toLowerCase().replace(/(.{4})/g, "$1 "), newCode: codeFor(next) });
    const u = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(u.totpSecret).toBe(next);
    expect(u.credentialsChangedAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { actorId: id, action: "staff.totp.change" } })).toBe(1);
  });

  it("refuses a damaged key before checking anything else", async () => {
    const id = await staff();
    await refused(service.changeAuthenticator(id, { currentPassword: PASSWORD, currentCode: codeFor(secret), newKey: "not-a-key!", newCode: "123456" }), /missing or damaged/);
  });
});
