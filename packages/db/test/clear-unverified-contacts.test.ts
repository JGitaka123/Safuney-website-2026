/** The one-off cleanup of contacts saved without a code. Needs a database (CI). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "../src/index";
import { clearUnverifiedContacts, findUnverifiedContacts, mask } from "../src/clear-unverified-contacts";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

describe("mask", () => {
  it("keeps enough to recognise a contact, not to copy it", () => {
    expect(mask({ userId: "u", kind: "email", value: "wanjiru@example.com" })).toBe("w******@example.com");
    expect(mask({ userId: "u", kind: "phone", value: "+254712345678" })).toBe("+2547******78");
  });
});

run("clear-unverified-contacts", () => {
  let prisma: PrismaClient;
  const stamp = Date.now().toString(36);
  const ids: string[] = [];
  const now = new Date();
  const phone = (n: number) => `+2547${String(Date.now() + n).slice(-8)}`;

  async function user(data: Parameters<PrismaClient["user"]["create"]>[0]["data"]) {
    const u = await prisma.user.create({ data });
    ids.push(u.id);
    return u.id;
  }

  beforeAll(() => {
    prisma = createTestClient(url!);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("clears an unproven contact only where a proven one remains, and leaves staff and invitations alone", async () => {
    const typedEmail = await user({ phone: phone(1), phoneVerified: now, email: `typed-${stamp}@example.test` });
    const typedPhone = await user({ email: `proven-${stamp}@example.test`, emailVerified: now, phone: phone(2) });
    const invited = await user({ email: `invited-${stamp}@example.test` });
    const staff = await user({ email: `staff-${stamp}@example.test`, role: "SALES", phone: phone(3), phoneVerified: now });
    const fine = await user({ email: `fine-${stamp}@example.test`, emailVerified: now, phone: phone(4), phoneVerified: now });

    const found = await findUnverifiedContacts(prisma, ids);
    expect(found.map((c) => [c.userId, c.kind]).sort()).toEqual([[typedEmail, "email"], [typedPhone, "phone"]].sort());
    // Looking changes nothing.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: typedEmail } })).email).toBe(`typed-${stamp}@example.test`);

    expect(await clearUnverifiedContacts(prisma, ids)).toHaveLength(2);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: typedEmail } })).email).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: typedPhone } })).phone).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: invited } })).email).toBe(`invited-${stamp}@example.test`);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff } })).email).toBe(`staff-${stamp}@example.test`);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fine } })).phone).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { entityId: { in: ids }, action: "profile.contact.cleanup" } })).toBe(2);

    // Running it again finds nothing.
    expect(await clearUnverifiedContacts(prisma, ids)).toHaveLength(0);
  });
});
