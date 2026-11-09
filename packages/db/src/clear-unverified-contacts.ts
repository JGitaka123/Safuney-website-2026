/**
 * One-off cleanup after #26: removes emails and phones that the old profile form saved without a code.
 *
 *   DATABASE_URL=... pnpm --filter @safuney/db clear-unverified-contacts          # shows what it would do
 *   DATABASE_URL=... pnpm --filter @safuney/db clear-unverified-contacts --apply  # does it
 *
 * Before #26 the profile saved a typed-in email or phone unchecked, and a later sign-in with that
 * contact opened the account it was typed into. Now a contact needs a code first, so only old rows
 * can still be like this.
 *
 * Only clears a contact on a customer account that also has a proven one, so the customer can still
 * sign in with that. Left alone: staff accounts, and accounts with no proven contact at all. Those are
 * organisation invitations waiting for a first sign-in. Each change is written to the audit log.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../generated/client/client";

const CUSTOMER_ROLES: UserRole[] = [UserRole.CUSTOMER, UserRole.B2B_BUYER, UserRole.B2B_APPROVER];

export interface UnverifiedContact {
  userId: string;
  kind: "email" | "phone";
  value: string;
}

/** Customer accounts holding one unproven contact next to a proven one. */
export async function findUnverifiedContacts(prisma: PrismaClient, only?: string[]): Promise<UnverifiedContact[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: CUSTOMER_ROLES },
      ...(only ? { id: { in: only } } : {}),
      OR: [
        { email: { not: null }, emailVerified: null, phone: { not: null }, phoneVerified: { not: null } },
        { phone: { not: null }, phoneVerified: null, email: { not: null }, emailVerified: { not: null } },
      ],
    },
    select: { id: true, email: true, emailVerified: true, phone: true },
    orderBy: { createdAt: "asc" },
  });
  return users.map((u) => (u.emailVerified ? { userId: u.id, kind: "phone" as const, value: u.phone! } : { userId: u.id, kind: "email" as const, value: u.email! }));
}

/**
 * Clears each contact found, checking again inside the write so a contact proven since is kept.
 * `only` limits it to some accounts (tests share a database with other suites).
 */
export async function clearUnverifiedContacts(prisma: PrismaClient, only?: string[]): Promise<UnverifiedContact[]> {
  const found = await findUnverifiedContacts(prisma, only);
  const cleared: UnverifiedContact[] = [];
  for (const c of found) {
    await prisma.$transaction(async (tx) => {
      const where = c.kind === "email" ? { id: c.userId, email: c.value, emailVerified: null, phoneVerified: { not: null } } : { id: c.userId, phone: c.value, phoneVerified: null, emailVerified: { not: null } };
      const { count } = await tx.user.updateMany({ where, data: c.kind === "email" ? { email: null } : { phone: null } });
      if (count === 0) return;
      await tx.auditLog.create({ data: { actorId: null, action: "profile.contact.cleanup", entity: "User", entityId: c.userId, before: { [c.kind]: c.value }, after: { [c.kind]: null, reason: "saved without a code before #26" } } });
      cleared.push(c);
    });
  }
  return cleared;
}

/** "w*****@example.com", "+2547*****12": enough to recognise, not to copy. */
export function mask(c: UnverifiedContact): string {
  if (c.kind === "email") {
    const [name = "", domain = ""] = c.value.split("@");
    return `${name.slice(0, 1)}${"*".repeat(Math.max(name.length - 1, 1))}@${domain}`;
  }
  return `${c.value.slice(0, 5)}${"*".repeat(Math.max(c.value.length - 7, 1))}${c.value.slice(-2)}`;
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const url = process.env["DATABASE_URL"];
  const apply = process.argv.includes("--apply");
  if (!url) {
    console.error("Usage: DATABASE_URL=... pnpm --filter @safuney/db clear-unverified-contacts [--apply]");
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  (apply ? clearUnverifiedContacts(prisma) : findUnverifiedContacts(prisma))
    .then((list) => {
      if (list.length === 0) console.log("Nothing to clean up: no customer account has an unproven email or phone next to a proven one.");
      else {
        console.log(`${apply ? "Cleared" : "Would clear"} ${list.length}:`);
        for (const c of list) console.log(`  ${c.userId}  ${c.kind.padEnd(5)}  ${mask(c)}`);
        if (!apply) console.log("\nNothing changed. Run again with --apply to clear them.");
      }
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e instanceof Error ? e.message : e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
