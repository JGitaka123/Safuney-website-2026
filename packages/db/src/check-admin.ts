/**
 * Read-only diagnosis for "I can't sign in" on a staff account.
 *
 *   DATABASE_URL=... pnpm --filter @safuney/db check-admin you@safuney.com
 *
 * Asks for the password and authenticator key without echoing them, then says only yes or no: whether
 * the account exists in this database, whether the password and key match, and the code the key gives
 * right now (to compare with the phone). Never prints a stored value, and changes nothing.
 */
import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { verifyPassword } from "./password";
import { PrismaClient } from "../generated/client/client";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function fromBase32(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text.replace(/[\s=]/g, "").toUpperCase()) {
    const i = BASE32.indexOf(ch);
    if (i < 0) throw new Error(`"${ch}" cannot appear in an authenticator key`);
    value = ((value << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238 TOTP, SHA-1, 6 digits, 30 seconds — the parameters the staff sign-in uses. */
export function totpNow(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", fromBase32(secret)).update(counter).digest();
  const offset = h[h.length - 1]! & 0x0f;
  const n = (h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(n).padStart(6, "0");
}

/** Reads a line without echoing it, so the password does not land on screen or in shell history. */
function askHidden(question: string): Promise<string> {
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl);
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => write(s.startsWith(question) ? s : "");
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      done(answer);
    });
  });
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const url = process.env["DATABASE_URL"];
  const email = process.argv[2]?.trim().toLowerCase();
  if (!url || !email) {
    console.error("Usage: DATABASE_URL=... pnpm --filter @safuney/db check-admin you@safuney.com");
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true, isActive: true, passwordHash: true, totpSecret: true } });
  await prisma.$disconnect();
  if (!user) {
    console.log(`No account for ${email} in this database. Check DATABASE_URL is the one production uses.`);
    process.exit(1);
  }
  const yes = (b: boolean) => (b ? "yes" : "NO");
  const password = await askHidden("Password (paste, not shown): ");
  const key = await askHidden("Authenticator key (paste, not shown, or press Enter to skip): ");
  console.log(`
  Account:               ${user.role}, active ${yes(user.isActive)}
  Password matches:      ${yes(verifyPassword(password, user.passwordHash))}${password !== password.trim() ? "   (what you pasted starts or ends with a space)" : ""}`);
  if (key) console.log(`  Key matches:           ${yes(user.totpSecret === key.replace(/\s+/g, "").toUpperCase())}`);
  if (user.totpSecret) console.log(`  Code right now:        ${totpNow(user.totpSecret)}   compare with the phone: different means another key or a wrong clock`);
  else console.log("  No authenticator set:  sign in with the code box empty");
}
