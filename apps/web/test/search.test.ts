/** Integration tests for site search. Skipped without DATABASE_URL (CI provides Postgres with the demo seed). */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";
import { normaliseQuery, searchCategories, searchDocuments, searchProducts, suggestions } from "@/lib/catalogue/search";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

run("site search", () => {
  let prisma: PrismaClient;
  // Unique per test file, not just per millisecond: parallel workers load these files at the same
  // instant, and two files sharing a stamp make their seeded products collide in search results.
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const exactName = `Citrus solvent degreaser ${stamp}`;
  const hiddenName = `Unreviewed lemon degreaser ${stamp}`;

  beforeAll(async () => {
    prisma = createTestClient(url!);
    const cat = await prisma.category.create({ data: { slug: `search-cat-${stamp}`, name: `Search test category ${stamp}` } });
    const visible = await prisma.product.create({
      data: { slug: `search-p-${stamp}`, name: exactName, shortDescription: "Heavy-duty degreaser for engine bays and workshop floors.", categoryId: cat.id, isActive: true, needsPoReview: false, tags: ["workshop"] },
    });
    await prisma.productVariant.create({ data: { productId: visible.id, sku: `SRCH-${stamp}`, packSizeValue: "5", unit: "L", packLabel: "5 L", priceMinorUnits: 180000n, vatRateBps: 1600, stockOnHand: 4 } });
    // Same words, a similar name, but not reviewed: it must never surface.
    const hidden = await prisma.product.create({
      data: { slug: `search-h-${stamp}`, name: hiddenName, shortDescription: "Heavy-duty degreaser for engine bays.", categoryId: cat.id, isActive: true, needsPoReview: true },
    });
    await prisma.productVariant.create({ data: { productId: hidden.id, sku: `SRCH-HIDDEN-${stamp}`, packSizeValue: "5", unit: "L", packLabel: "5 L", priceMinorUnits: 180000n, stockOnHand: 4 } });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug: { endsWith: stamp } } });
    await prisma.category.deleteMany({ where: { slug: `search-cat-${stamp}` } });
    await prisma.$disconnect();
  });

  it("ranks an exact name match first", async () => {
    const hits = await searchProducts(exactName);
    expect(hits[0]?.name).toBe(exactName);
    expect(hits[0]?.categoryPath).toBe(`search-cat-${stamp}`);
    expect(hits[0]?.variants[0]?.sku).toBe(`SRCH-${stamp}`);
  });

  it("ranks the product whose name carries the words above one that only mentions them", async () => {
    // Several catalogue products are cleaners; only one is named for windows.
    const hits = await searchProducts("window cleaner");
    expect(hits[0]?.slug).toBe("saf-window-cleaner");
  });

  it("tolerates typos: 'sanitzer' still finds the hand sanitiser", async () => {
    const hits = await searchProducts("sanitzer");
    expect(hits.map((h) => h.slug)).toContain("sanitouch");
  });

  it("finds by SKU", async () => {
    const hits = await searchProducts(`SRCH-${stamp}`);
    expect(hits.map((h) => h.name)).toEqual([exactName]);
  });

  it("never returns unreviewed products", async () => {
    const byName = await searchProducts(hiddenName);
    expect(byName.map((h) => h.name)).not.toContain(hiddenName);
    const bySku = await searchProducts(`SRCH-HIDDEN-${stamp}`);
    expect(bySku.map((h) => h.slug)).not.toContain(`search-h-${stamp}`);
    // "degreaser" also matches real catalogue products, so this asserts the exclusion, not the set.
    const byWords = await searchProducts(`degreaser ${stamp}`);
    expect(byWords.map((h) => h.name)).toContain(exactName);
    expect(byWords.map((h) => h.name)).not.toContain(hiddenName);
  });

  it("returns nothing for queries shorter than two characters and caps long ones", async () => {
    expect(await searchProducts("")).toEqual([]);
    expect(await searchProducts(" s ")).toEqual([]);
    expect(normaliseQuery("  a  ")).toBe("");
    expect(normaliseQuery("x".repeat(500))).toHaveLength(100);
    expect(await searchProducts("%")).toEqual([]);
  });

  it("respects the limit", async () => {
    const hits = await searchProducts("cleaner", { limit: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it("finds categories with visible products, including with a typo", async () => {
    const exact = await searchCategories("disinfection");
    expect(exact[0]?.slug).toBe("disinfection");
    expect(exact[0]?.href).toBe("/products/disinfection");
    const typo = await searchCategories("disinfecton");
    expect(typo.map((c) => c.slug)).toContain("disinfection");
    // The test category holds only one visible product, so it appears; an empty category would not.
    const mine = await searchCategories(`Search test category ${stamp}`);
    expect(mine[0]?.productCount).toBe(1);
  });

  it("returns an empty document list cleanly when nothing matches", async () => {
    expect(await searchDocuments(`no-such-document-${stamp}`)).toEqual([]);
    expect(await searchDocuments("s")).toEqual([]);
  });

  it("suggests the four zones and up to four categories for the empty state", async () => {
    const s = await suggestions();
    expect(s.zones.map((z) => z.key)).toEqual(["RED", "BLUE", "GREEN", "YELLOW"]);
    expect(s.categories.length).toBeGreaterThan(0);
    expect(s.categories.length).toBeLessThanOrEqual(4);
  });
});
