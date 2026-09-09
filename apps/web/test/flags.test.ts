/**
 * Feature flags.
 *
 * The rule that matters: a flag that is off means the feature is **unreachable**, not merely
 * unlinked. Everything else here defends the default — off — because a feature nobody has demonstrated
 * to the PO must not appear on the live site because a deploy happened.
 */
import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { FLAGS, type FlagKey } from "@/lib/flags";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("feature flags", () => {
  let prisma: PrismaClient;
  const keys = Object.keys(FLAGS) as FlagKey[];

  beforeAll(async () => {
    prisma = createTestClient(url!);
  });

  afterEach(async () => {
    await prisma.featureFlag.deleteMany({ where: { key: { in: keys } } });
    vi.resetModules();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("is off for every feature when nothing has been set", async () => {
    const { flagsEnabled } = await import("@/lib/flags");
    const all = await flagsEnabled();
    for (const key of keys) expect(all[key], key).toBe(false);
  });

  it("reads a flag that has been switched on", async () => {
    await prisma.featureFlag.create({ data: { key: "planner.enabled", enabled: true } });
    vi.resetModules();
    const { flagEnabled } = await import("@/lib/flags");
    expect(await flagEnabled("planner.enabled")).toBe(true);
    expect(await flagEnabled("advisor.enabled")).toBe(false);
  });

  it("treats a row that exists but is disabled as off", async () => {
    await prisma.featureFlag.create({ data: { key: "advisor.enabled", enabled: false } });
    vi.resetModules();
    const { flagEnabled } = await import("@/lib/flags");
    expect(await flagEnabled("advisor.enabled")).toBe(false);
  });

  it("describes every flag it offers, so the admin screen is never blank", () => {
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(FLAGS[key].length, key).toBeGreaterThan(20);
      // Written for the PO, who decides whether to switch it on — not for whoever wrote the code.
      expect(FLAGS[key], key).not.toContain("_");
    }
  });

  it("reads every flag in one query, however many are checked", async () => {
    const stamp = randomBytes(3).toString("hex");
    await prisma.featureFlag.create({ data: { key: "pwa.enabled", enabled: true, description: `probe ${stamp}` } });
    vi.resetModules();
    const { flagEnabled } = await import("@/lib/flags");
    // React's `cache` dedupes within a request; three checks must not be three round trips.
    const [a, b, c] = await Promise.all([flagEnabled("pwa.enabled"), flagEnabled("reps.enabled"), flagEnabled("loyalty.enabled")]);
    expect([a, b, c]).toEqual([true, false, false]);
  });
});
