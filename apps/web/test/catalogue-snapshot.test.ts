import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { getCategories, getProductsBySlug } from "@/lib/catalogue";
import { parseFilters } from "@/lib/catalogue/filters";
import { catalogueSource } from "@/lib/catalogue/queries";
import {
  SNAPSHOT_ID_PREFIX,
  snapshotCardsBySlug,
  snapshotCategoryCounts,
  snapshotCategoryPage,
  snapshotPaths,
  snapshotProduct,
  snapshotSearch,
} from "@/lib/catalogue/static";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

describe("catalogue snapshot (ADR 0017)", () => {
  it("matches the catalogue files it was compiled from", () => {
    // Fails when catalogue-seed.csv, catalogue-images.json or catalogue-meta.json changed and
    // `pnpm catalogue:snapshot` was not re-run.
    expect(() => execFileSync(process.execPath, ["scripts/catalogue-snapshot.mjs", "--check"], { cwd: ROOT, stdio: "pipe" })).not.toThrow();
  });

  it("has products in every range the site links to", () => {
    const counts = snapshotCategoryCounts();
    for (const area of site.productAreas) expect(counts[area.slug], area.slug).toBeGreaterThan(0);
  });

  it("holds every product the home page features, in order", () => {
    expect(snapshotCardsBySlug(site.featuredProducts).map((p) => p.slug)).toEqual([...site.featuredProducts]);
  });

  it("sells nothing: every pack is price on application and carries a snapshot id", () => {
    for (const { category, product } of snapshotPaths()) {
      const p = snapshotProduct(category, product);
      expect(p?.fromSnapshot).toBe(true);
      for (const v of p?.variants ?? []) {
        expect(v.priceMinorUnits).toBe(0n);
        expect(v.id.startsWith(SNAPSHOT_ID_PREFIX)).toBe(true);
      }
    }
  });

  it("names the same SKUs the seed does, so a quote and the seeded database agree", () => {
    expect(snapshotProduct("disinfection", "saf-quartsan")?.variants.map((v) => v.sku)).toEqual(["SAF-QUARTSAN-5L", "SAF-QUARTSAN-20L"]);
    // A product the catalogue lists without a pack size takes the bare code, not a slug of the label.
    expect(snapshotProduct("disinfection", "saf-bactosan")?.variants.map((v) => v.sku)).toEqual(["SAF-BACTOSAN"]);
  });

  it("carries the catalogue's dosing through to the product page", () => {
    const multiklin = snapshotProduct("housekeeping", "saf-multiklin");
    expect(multiklin?.dilutionGuidance).toEqual([
      { use: "Heavy soil", ratio: 10 },
      { use: "General cleaning", ratio: 100 },
    ]);
  });

  it("only finds a product under its own range", () => {
    expect(snapshotProduct("laundry", "saf-quartsan")).toBeNull();
    expect(snapshotProduct("laundry", "does-not-exist")).toBeNull();
  });

  it("filters a listing by pack size, and offers neither stock nor non-sizes as filters", () => {
    const page = snapshotCategoryPage("disinfection", { ...parseFilters({}), packs: ["4 kg"] });
    expect(page?.products.map((p) => p.slug)).toEqual(["saf-salad-wash"]);
    expect(page?.total).toBe(1);
    expect(page?.facets.availability).toBe(false);
    expect(page?.facets.packs.map((f) => f.value)).not.toContain("Pack size on request");
  });

  it("has no listing for a range that does not exist", () => {
    expect(snapshotCategoryPage("does-not-exist", parseFilters({}))).toBeNull();
  });

  it("searches by name, forgivingly", () => {
    expect(snapshotSearch("quartsan", 5)[0]?.card.slug).toBe("saf-quartsan");
    expect(snapshotSearch("grease", 5).map((r) => r.card.slug)).toContain("grease-buster");
    expect(snapshotSearch("hand wash", 10).map((r) => r.card.slug)).toContain("sanibac");
    expect(snapshotSearch("zzzz", 5)).toEqual([]);
  });

  it("finds a product through a slip in the spelling, as the database search does", () => {
    expect(snapshotSearch("sanitzer", 8).map((r) => r.card.slug)).toContain("sanitouch");
    expect(snapshotSearch("degreser", 8).map((r) => r.card.slug)).toContain("saf-degreaser");
    // Nonsense still finds nothing, and a correct spelling still ranks first.
    expect(snapshotSearch("zzqxv", 8)).toEqual([]);
    expect(snapshotSearch("quartsan", 8)[0]?.card.slug).toBe("saf-quartsan");
  });

  it("is what the site reads when no database is configured", async () => {
    const saved = process.env["DATABASE_URL"];
    delete process.env["DATABASE_URL"];
    try {
      expect(await catalogueSource()).toBe("snapshot");
      const categories = await getCategories();
      expect(categories.map((c) => c.slug)).toEqual(site.productAreas.map((a) => a.slug));
      expect(categories.reduce((n, c) => n + (c.productCount ?? 0), 0)).toBe(snapshotPaths().length);
      expect(categories.every((c) => c.image !== null)).toBe(true);
      expect((await getProductsBySlug(site.featuredProducts)).length).toBe(site.featuredProducts.length);
    } finally {
      if (saved !== undefined) process.env["DATABASE_URL"] = saved;
    }
  });
});
