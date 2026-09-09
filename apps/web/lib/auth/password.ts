import * as OTPAuth from "otpauth";

export { hashPassword, verifyPassword } from "@safuney/db/password";

const ISSUER = "Safuney";

export function newTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function totpUri(secret: string, label: string): string {
  return new OTPAuth.TOTP({ issuer: ISSUER, label, secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 }).toString();
}

/** Accepts the current code and its neighbours (±1 period) for clock drift. */
export function verifyTotp(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({ issuer: ISSUER, secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
  return totp.validate({ token: code.replace(/\s+/g, ""), window: 1 }) !== null;
}
