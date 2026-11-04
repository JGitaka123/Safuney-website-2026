/** Customer sign-in codes never open a staff account. Needs a database (CI). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("customer sign-in and staff accounts", () => {
  let prisma: PrismaClient;
  let mod: typeof import("@/lib/auth/customer-sign-in");
  let otp: typeof import("@/lib/auth/otp");
  const stamp = Date.now().toString(36);
  const staffEmail = `guard-admin-${stamp}@example.test`;
  const staffPhone = `+2547${String(Date.now()).slice(-8)}`;
  const customerEmail = `guard-customer-${stamp}@example.test`;
  const original = process.env["PAYMENTS_MODE"];

  beforeAll(async () => {
    process.env["PAYMENTS_MODE"] = "mock"; // codes come back to the test instead of being sent
    prisma = createTestClient(url!);
    mod = await import("@/lib/auth/customer-sign-in");
    otp = await import("@/lib/auth/otp");
    await prisma.user.create({ data: { email: staffEmail, phone: staffPhone, role: "ADMIN", passwordHash: "x", totpSecret: "JBSWY3DPEHPK3PXP" } });
  });

  afterAll(async () => {
    process.env["PAYMENTS_MODE"] = original;
    await prisma.verificationToken.deleteMany({ where: { identifier: { in: [`email:${staffEmail}`, `phone:${staffPhone}`, `email:${customerEmail}`] } } });
    await prisma.user.deleteMany({ where: { email: { in: [staffEmail, customerEmail] } } });
    await prisma.$disconnect();
  });

  async function codeFor(identifier: string): Promise<string> {
    const r = await otp.requestOtp(identifier);
    if (!r.ok || !r.mockCode) throw new Error("expected a mock code");
    return r.mockCode;
  }

  it("knows a staff email and phone from a customer's", async () => {
    expect(await mod.isStaffContact(prisma, `email:${staffEmail}`)).toBe(true);
    expect(await mod.isStaffContact(prisma, `phone:${staffPhone}`)).toBe(true);
    expect(await mod.isStaffContact(prisma, `email:${customerEmail}`)).toBe(false);
  });

  it("refuses a correct emailed code for a staff account, and leaves the account as it was", async () => {
    const code = await codeFor(`email:${staffEmail}`);
    expect(await mod.customerFromCode(prisma, staffEmail, code)).toBeNull();
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } });
    expect(staff.emailVerified).toBeNull();
    expect(staff.role).toBe("ADMIN");
  });

  it("refuses a correct texted code for a staff account's phone", async () => {
    const code = await codeFor(`phone:${staffPhone}`);
    expect(await mod.customerFromCode(prisma, staffPhone, code)).toBeNull();
  });

  it("still signs a customer in, creating the account on first use", async () => {
    const code = await codeFor(`email:${customerEmail}`);
    const user = await mod.customerFromCode(prisma, customerEmail, code);
    expect(user?.email).toBe(customerEmail);
    expect(user?.role).toBe("CUSTOMER");
    expect(user?.emailVerified).toBeInstanceOf(Date);
  });
});
