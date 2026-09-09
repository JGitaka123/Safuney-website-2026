import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import * as OTPAuth from "otpauth";

/** scrypt with a per-user salt; format `scrypt:<salt>:<hash>`. Staff only (customers never have passwords). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

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
