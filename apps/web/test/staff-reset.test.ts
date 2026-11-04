/** An administrator resets a staff member's sign-in. Needs a database (CI). */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, type PrismaClient, type UserRole } from "@safuney/db";
import { hashPassword, verifyPassword } from "@safuney/db/password";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

let current: { id: string; role: UserRole } | null = null;
vi.mock("@/lib/auth/session", () => ({
  viewer: async () => (current ? { ...current, name: null, email: `${current.role}@example.test`, phone: null, memberships: [] } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { resetStaffSignIn } = await import("@/lib/admin/settings-actions");

run("admin reset of a staff sign-in", () => {
  let prisma: PrismaClient;
  const stamp = Date.now().toString(36);
  const ids: Record<string, string> = {};
  const OLD_PASSWORD = "old-password-for-the-test";
  const OLD_KEY = "JBSWY3DPEHPK3PXPJBSWY3DP";

  beforeAll(async () => {
    prisma = createTestClient(url!);
    for (const role of ["ADMIN", "SALES", "WAREHOUSE", "FINANCE", "CUSTOMER"] as UserRole[]) {
      ids[role] = (await prisma.user.create({ data: { email: `reset-${role.toLowerCase()}-${stamp}@example.test`, role, passwordHash: hashPassword(OLD_PASSWORD), totpSecret: OLD_KEY } })).id;
    }
  });

  beforeEach(() => {
    current = null;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await prisma.$disconnect();
  });

  it("gives the person a new password and key, ends their sessions, and logs neither secret", async () => {
    current = { id: ids["ADMIN"]!, role: "ADMIN" };
    const before = Date.now();
    const r = await resetStaffSignIn(ids["WAREHOUSE"]!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { password, key, uri } = r.reveal!;
    expect(password).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toMatch(/^[A-Z2-7]{16,}$/);
    expect(uri).toContain(`secret=${key}`);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids["WAREHOUSE"]! } });
    expect(verifyPassword(password!, user.passwordHash)).toBe(true);
    expect(verifyPassword(OLD_PASSWORD, user.passwordHash)).toBe(false);
    expect(user.totpSecret).toBe(key);
    expect(user.credentialsChangedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "staff.reset", entityId: ids["WAREHOUSE"]! } });
    expect(audit.actorId).toBe(ids["ADMIN"]);
    const logged = JSON.stringify(audit);
    expect(logged).not.toContain(password!);
    expect(logged).not.toContain(key!);
  });

  it("refuses an administrator resetting themselves, and sends them to the Security page", async () => {
    current = { id: ids["ADMIN"]!, role: "ADMIN" };
    const r = await resetStaffSignIn(ids["ADMIN"]!);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Security page");
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: ids["ADMIN"]! } });
    expect(verifyPassword(OLD_PASSWORD, admin.passwordHash)).toBe(true);
  });

  it("is for administrators only", async () => {
    for (const role of ["SALES", "WAREHOUSE", "FINANCE", "CUSTOMER"] as UserRole[]) {
      current = { id: ids[role]!, role };
      const r = await resetStaffSignIn(ids["SALES"]!);
      expect(r.ok, role).toBe(false);
    }
    const sales = await prisma.user.findUniqueOrThrow({ where: { id: ids["SALES"]! } });
    expect(sales.totpSecret).toBe(OLD_KEY);
  });

  it("does not touch a customer account", async () => {
    current = { id: ids["ADMIN"]!, role: "ADMIN" };
    const r = await resetStaffSignIn(ids["CUSTOMER"]!);
    expect(r.ok).toBe(false);
    const customer = await prisma.user.findUniqueOrThrow({ where: { id: ids["CUSTOMER"]! } });
    expect(customer.totpSecret).toBe(OLD_KEY);
  });
});
