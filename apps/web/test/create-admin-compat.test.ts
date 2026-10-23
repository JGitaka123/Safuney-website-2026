import { randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import { describe, expect, it } from "vitest";
import { base32 } from "@safuney/db/create-admin";
import { hashPassword, verifyPassword, verifyTotp } from "@/lib/auth/password";

describe("create-admin output signs in", () => {
  it("its key produces codes the staff sign-in accepts, and its password verifies", () => {
    const secret = base32(randomBytes(20));
    const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 }).generate();
    expect(verifyTotp(secret, code)).toBe(true);
    const password = randomBytes(16).toString("hex");
    expect(verifyPassword(password, hashPassword(password))).toBe(true);
  });
});
