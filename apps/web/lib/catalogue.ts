import { cache } from "react";
import { db } from "@safuney/db";
import type { ZoneKey } from "@safuney/ui";
import { site, type ProductArea } from "@/config/site";
import { cardSelect, catalogueSource, VISIBLE_PRODUCT, type ProductCardData } from "./catalogue/queries";
import { snapshotCardsBySlug, snapshotCategoryCounts, snapshotImage, snapshotTopItems, snapshotTopNames, snapshotZoneCounts } from "./catalogue/static";

export interface CategorySummary {
  slug: string;
  name: string;
  blurb: string;
  zones: readonly ZoneKey[];
  /** Number of published, active products. */
  productCount: number | null;
  /** The pack shot that stands for the range on tiles. */
  image: { url: string; width: number; height: number; alt: string } | null;
  /** The first few product names in the range, for tiles: buyers scan for names, not descriptions. */
  topProducts: string[];
  /** The same products with their slugs and pack sizes, for the "shop by range" cards. */
  topItems: Array<{ slug: string; name: string; packs: string }>;
}

/**
 * The pack shot that stands for each range: the catalogue's best-known product in it. Tiles need a
 * picture of a range and the catalogue has no range photography, so one real pack speaks for it.
 */
const RANGE_FEATURE: Record<string, string> = {
  warewashing: "saf-autoklin",
  disinfection: "saf-quartsan",
  specialty: "grease-buster",
  "personal-hygiene": "sanibac",
  housekeeping: "saf-multiklin",
  "process-hygiene": "saftex-liquid",
  laundry: "saflin-015-one-shot",
  bactro: "bactro-extreme-liquid",
  equipment: "janitor-trolley",
};

export function rangeImage(slug: string): CategorySummary["image"] {
  const feature = RANGE_FEATURE[slug];
  return feature ? snapshotImage(feature) : null;
}

/**
 * Categories for navigation and the home page, in the catalogue's own order with the copy from
 * config/site.ts. Counts come from wherever the catalogue is being read (queries.ts `catalogueSource`):
 * the database once it holds published products, the catalogue snapshot until then.
 */
export const getCategories = cache(async (): Promise<CategorySummary[]> => {
  const counts = snapshotCategoryCounts();
  const fromSnapshot: CategorySummary[] = site.productAreas.map((a: ProductArea) => ({
    slug: a.slug,
    name: a.name,
    blurb: a.blurb,
    zones: a.zones,
    productCount: counts[a.slug] ?? 0,
    image: rangeImage(a.slug),
    topProducts: snapshotTopNames(a.slug),
    topItems: snapshotTopItems(a.slug),
  }));
  if ((await catalogueSource()) === "snapshot") return fromSnapshot;
  try {
    const rows = await db().category.findMany({
      where: { isActive: true, parentId: null },
      select: { slug: true, _count: { select: { products: { where: VISIBLE_PRODUCT } } } },
    });
    const bySlug = new Map(rows.map((r) => [r.slug, r._count.products]));
    return fromSnapshot.map((c) => ({ ...c, productCount: bySlug.get(c.slug) ?? 0 }));
  } catch (error) {
    console.error("getCategories: database unavailable, using the catalogue snapshot counts", error);
    return fromSnapshot;
  }
});

export const getZoneCounts = cache(async (): Promise<Partial<Record<ZoneKey, number>> | null> => {
  if ((await catalogueSource()) === "snapshot") return snapshotZoneCounts();
  try {
    const grouped = await db().product.groupBy({
      by: ["zone"],
      where: VISIBLE_PRODUCT,
      _count: { _all: true },
    });
    const out: Partial<Record<ZoneKey, number>> = {};
    for (const g of grouped) if (g.zone !== "NONE") out[g.zone as ZoneKey] = g._count._all;
    return out;
  } catch (error) {
    console.error("getZoneCounts: database unavailable", error);
    return null;
  }
});

/** Product cards for the given slugs, in that order, from wherever the catalogue is being read. */
export const getProductsBySlug = cache(async (slugs: readonly string[]): Promise<ProductCardData[]> => {
  if ((await catalogueSource()) === "snapshot") return snapshotCardsBySlug(slugs);
  try {
    const rows = await db().product.findMany({ where: { ...VISIBLE_PRODUCT, slug: { in: [...slugs] } }, select: cardSelect });
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    return slugs.flatMap((s) => {
      const row = bySlug.get(s);
      return row ? [row] : [];
    });
  } catch (error) {
    console.error("getProductsBySlug: database unavailable, using the catalogue snapshot", error);
    return snapshotCardsBySlug(slugs);
  }
});
