import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient } from "@safuney/db";
import { hashPassword, newTotpSecret, totpUri, verifyPassword, verifyTotp } from "@/lib/auth/password";
import * as OTPAuth from "otpauth";

describe("staff passwords and TOTP", () => {
  it("hashes with a per-user salt and verifies only the right password", () => {
    const a = hashPassword("correct horse battery staple");
    const b = hashPassword("correct horse battery staple");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt:")).toBe(true);
    expect(verifyPassword("correct horse battery staple", a)).toBe(true);
    expect(verifyPassword("correct horse battery stapl", a)).toBe(false);
    expect(verifyPassword("anything", null)).toBe(false);
    expect(verifyPassword("anything", "plain:not-a-hash")).toBe(false);
  });

  it("accepts the current TOTP code and rejects a stale one", () => {
    const secret = newTotpSecret();
    expect(totpUri(secret, "staff@safuney.com")).toContain("otpauth://totp/Safuney:staff%40safuney.com");
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
    expect(verifyTotp(secret, totp.generate())).toBe(true);
    expect(verifyTotp(secret, totp.generate({ timestamp: Date.now() - 5 * 60_000 }))).toBe(false);
    expect(verifyTotp(secret, "000000")).toBe(verifyTotp(secret, "000000")); // deterministic, no throw
  });
});

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("one-time codes", () => {
  const prisma = createTestClient(url!);
  const identifier = "phone:+254700000999";
  beforeAll(async () => {
    process.env["PAYMENTS_MODE"] = "mock";
    await prisma.verificationToken.deleteMany({ where: { identifier } });
  });
  afterAll(async () => {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.$disconnect();
  });

  it("issues a hashed code, verifies it once, and burns it after too many wrong attempts", async () => {
    const { requestOtp, verifyOtp, OTP_MAX_ATTEMPTS } = await import("@/lib/auth/otp");
    const issued = await requestOtp(identifier);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.mockCode).toMatch(/^\d{6}$/);
    const row = await prisma.verificationToken.findFirstOrThrow({ where: { identifier } });
    expect(row.token).not.toContain(issued.mockCode!);

    expect((await verifyOtp(identifier, "000000")).ok).toBe(false);
    expect(await verifyOtp(identifier, issued.mockCode!)).toEqual({ ok: true });
    // Consumed: the same code no longer works.
    expect((await verifyOtp(identifier, issued.mockCode!)).ok).toBe(false);

    const again = await requestOtp(identifier);
    if (!again.ok) throw new Error("expected a code");
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) expect(await verifyOtp(identifier, "111111")).toEqual({ ok: false, reason: "wrong" });
    expect(await verifyOtp(identifier, "111111")).toEqual({ ok: false, reason: "too_many" });
    expect((await verifyOtp(identifier, again.mockCode!)).ok).toBe(false);
  });
});
