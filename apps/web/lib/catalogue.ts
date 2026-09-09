import { cache } from "react";
import { db } from "@safuney/db";
import type { ZoneKey } from "@safuney/ui";
import { services } from "./env";
import { site, type ProductArea } from "@/config/site";

export interface CategorySummary {
  slug: string;
  name: string;
  blurb: string;
  zones: readonly ZoneKey[];
  /** Number of reviewed, active products; null when the database is not configured. */
  productCount: number | null;
}

/**
 * Categories for navigation and the home page. Reads the database when configured (only active,
 * PO-reviewed products count); otherwise falls back to the static list in config/site.ts so the site
 * always renders. Unreviewed products never reach the page (plan §6.5).
 */
export const getCategories = cache(async (): Promise<CategorySummary[]> => {
  const fallback: CategorySummary[] = site.productAreas.map((a: ProductArea) => ({
    slug: a.slug,
    name: a.name,
    blurb: a.blurb,
    zones: a.zones,
    productCount: null,
  }));
  if (!services.database()) return fallback;
  try {
    const rows = await db().category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        description: true,
        _count: { select: { products: { where: { isActive: true, needsPoReview: false } } } },
      },
    });
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    // Keep the curated order and copy from site.ts; take live counts from the database.
    return fallback.map((c) => {
      const row = bySlug.get(c.slug);
      return row ? { ...c, productCount: row._count.products } : { ...c, productCount: 0 };
    });
  } catch (error) {
    console.error("getCategories: database unavailable, using static categories", error);
    return fallback;
  }
});

export const getZoneCounts = cache(async (): Promise<Partial<Record<ZoneKey, number>> | null> => {
  if (!services.database()) return null;
  try {
    const grouped = await db().product.groupBy({
      by: ["zone"],
      where: { isActive: true, needsPoReview: false },
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
