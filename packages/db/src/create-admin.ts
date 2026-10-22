/**
 * Creates the first administrator — or recovers one who has lost their password or authenticator.
 *
 *   DATABASE_URL=... pnpm --filter @safuney/db create-admin you@safuney.com "Your Name"
 *
 * Staff accounts are otherwise created in /admin/staff, which needs an administrator to be signed in
 * already; on a fresh production database there is none, and the demo seed refuses production. Anyone
 * who can run this already holds DATABASE_URL, so it grants nothing they could not do by hand.
 *
 * A new password and authenticator secret are generated and printed once. If the address already has
 * an account it is made an active ADMIN and both are replaced, so the old ones stop working.
 */
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "./password";
import { PrismaClient, UserRole } from "../generated/client/client";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 without padding — what authenticator apps expect, and what otpauth produces in the web app. */
export function base32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export async function createAdmin(prisma: PrismaClient, email: string, name: string | null) {
  const address = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) throw new Error(`"${email}" is not an email address`);
  // 18 bytes → 24 base64url characters, comfortably past the 12-character minimum /admin/staff enforces.
  const password = randomBytes(18).toString("base64url");
  const totpSecret = base32(randomBytes(20));
  const data = { role: UserRole.ADMIN, passwordHash: hashPassword(password), totpSecret, isActive: true, emailVerified: new Date() };
  const existing = await prisma.user.findUnique({ where: { email: address }, select: { id: true } });
  if (existing) await prisma.user.update({ where: { id: existing.id }, data });
  else await prisma.user.create({ data: { email: address, name, ...data } });
  const uri = `otpauth://totp/Safuney:${encodeURIComponent(address)}?issuer=Safuney&secret=${totpSecret}&algorithm=SHA1&digits=6&period=30`;
  return { address, password, totpSecret, uri, replaced: Boolean(existing) };
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const url = process.env["DATABASE_URL"];
  const [email, ...nameParts] = process.argv.slice(2);
  if (!url || !email) {
    console.error('Usage: DATABASE_URL=... pnpm --filter @safuney/db create-admin you@safuney.com "Your Name"');
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  createAdmin(prisma, email, nameParts.join(" ").trim() || null)
    .then((r) => {
      console.log(`
${r.replaced ? "Existing account reset to ADMIN" : "Administrator created"}: ${r.address}

  Password:            ${r.password}
  Authenticator key:   ${r.totpSecret}

In Google Authenticator or Microsoft Authenticator choose "Enter a setup key", account name
Safuney, and type the key above (time-based). Or paste this into a QR generator you trust:
  ${r.uri}

Sign in at /sign-in/staff. This is shown once — store the password in a password manager now.
`);
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e instanceof Error ? e.message : e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
