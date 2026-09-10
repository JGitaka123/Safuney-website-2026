import { Prisma, type ApplicationZone, type HazardClass, type Unit } from "@safuney/db";
import type { ZoneKey } from "@safuney/ui";
import { assembleCategoryPage } from "./assemble";
import type { CatalogueFilters } from "./filters";
import type { CategoryPage, ProductCardData, ProductDetail } from "./queries";
import data from "./snapshot.json";

/*
 * The catalogue snapshot (ADR 0017): Safuney's own printed catalogue, compiled by
 * scripts/catalogue-snapshot.mjs into snapshot.json, served in the same shapes the database queries
 * return. It is what the shop window shows until the database holds published products, so a visitor
 * never meets an empty shelf because an environment variable is missing.
 *
 * Everything here is price on application: every variant is 0, which the product page renders as
 * "Price on request" with a quote button, and which the cart refuses server-side (lib/cart/service.ts).
 * Ids carry the `catalogue:` prefix so nothing downstream can mistake one for a database row.
 */

interface SnapshotVariant {
  sku: string;
  packLabel: string;
  packSizeValue: string;
  unit: string;
  vatRateBps: number;
}

interface SnapshotProduct {
  slug: string;
  name: string;
  brand: string | null;
  categorySlug: string;
  shortDescription: string;
  zone: string;
  hazardClass: string;
  dilutionText: string | null;
  dilutionGuidance: Array<{ use: string; ratio: number; contactTimeMinutes?: number; note?: string }>;
  image: { url: string; width: number; height: number; alt: string } | null;
  variants: SnapshotVariant[];
}

interface SnapshotCategory {
  slug: string;
  name: string;
  description: string;
  zone: string;
}

interface Snapshot {
  source: string;
  categories: SnapshotCategory[];
  products: SnapshotProduct[];
}

const SNAPSHOT = data as Snapshot;
const CATEGORIES = new Map(SNAPSHOT.categories.map((c) => [c.slug, c]));
const PRODUCTS = new Map(SNAPSHOT.products.map((p) => [p.slug, p]));

export const SNAPSHOT_ID_PREFIX = "catalogue:";

/** The date on the catalogue the snapshot is transcribed from. */
const CATALOGUE_DATE = new Date("2024-07-01T00:00:00Z");

function toCard(p: SnapshotProduct): ProductCardData {
  const category = CATEGORIES.get(p.categorySlug);
  return {
    id: `${SNAPSHOT_ID_PREFIX}${p.slug}`,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    shortDescription: p.shortDescription,
    zone: p.zone as ApplicationZone,
    hazardClass: p.hazardClass as HazardClass,
    tags: [],
    category: { slug: p.categorySlug, name: category?.name ?? p.categorySlug, zone: (category?.zone ?? "NONE") as ApplicationZone },
    images: p.image ? [{ url: p.image.url, alt: p.image.alt, width: p.image.width, height: p.image.height }] : [],
    variants: p.variants.map((v, i) => ({
      id: `${SNAPSHOT_ID_PREFIX}${v.sku}`,
      sku: v.sku,
      packLabel: v.packLabel,
      packSizeValue: new Prisma.Decimal(v.packSizeValue),
      unit: v.unit as Unit,
      priceMinorUnits: 0n,
      compareAtMinorUnits: null,
      vatRateBps: v.vatRateBps,
      // Stock is unknown, not zero: the listing hides the availability filter in snapshot mode, and a
      // price-on-application pack never shows a stock line (PurchasePanel).
      stockOnHand: 0,
      stockReserved: 0,
      lowStockThreshold: 0,
      isMadeToOrder: false,
      isActive: true,
      sortOrder: i,
      weightGrams: null,
      barcode: null,
    })),
  };
}

export function snapshotCards(categorySlug?: string): ProductCardData[] {
  return SNAPSHOT.products.filter((p) => !categorySlug || p.categorySlug === categorySlug).map(toCard);
}

/** Cards for the given slugs, in the given order; unknown slugs are skipped. */
export function snapshotCardsBySlug(slugs: readonly string[]): ProductCardData[] {
  return slugs.flatMap((slug) => {
    const p = PRODUCTS.get(slug);
    return p ? [toCard(p)] : [];
  });
}

/** The catalogue's own pack shot for a product, for tiles that need a picture of a range. */
export function snapshotImage(slug: string): SnapshotProduct["image"] {
  return PRODUCTS.get(slug)?.image ?? null;
}

/** The first product names in a range, in catalogue order: what a buyer scans a range tile for. */
export function snapshotTopNames(categorySlug: string, count = 3): string[] {
  return SNAPSHOT.products
    .filter((p) => p.categorySlug === categorySlug)
    .slice(0, count)
    .map((p) => p.name);
}

export function snapshotCategoryCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of SNAPSHOT.products) out[p.categorySlug] = (out[p.categorySlug] ?? 0) + 1;
  return out;
}

export function snapshotZoneCounts(): Partial<Record<ZoneKey, number>> {
  const out: Partial<Record<ZoneKey, number>> = {};
  for (const p of SNAPSHOT.products) if (p.zone !== "NONE") out[p.zone as ZoneKey] = (out[p.zone as ZoneKey] ?? 0) + 1;
  return out;
}

export function snapshotPaths(): Array<{ category: string; product: string }> {
  return SNAPSHOT.products.map((p) => ({ category: p.categorySlug, product: p.slug }));
}

/** Same semantics as the database `where` in queries.ts, applied in memory. */
function matches(p: ProductCardData, f: CatalogueFilters): boolean {
  if (f.zone && p.zone !== f.zone) return false;
  if (f.brands.length && !(p.brand && f.brands.includes(p.brand))) return false;
  if (f.applications.length && !p.tags.some((t) => f.applications.includes(t))) return false;
  const packOk = p.variants.some((v) => {
    if (f.packs.length && !f.packs.includes(v.packLabel)) return false;
    if (f.priceMin !== undefined && v.priceMinorUnits < BigInt(f.priceMin) * 100n) return false;
    if (f.priceMax !== undefined && v.priceMinorUnits > BigInt(f.priceMax) * 100n + 99n) return false;
    if (f.inStock && !(v.isMadeToOrder || v.stockOnHand > 0)) return false;
    return true;
  });
  if (!packOk) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const haystack = [p.name, p.brand ?? "", p.shortDescription, ...p.variants.map((v) => v.sku)];
    if (!haystack.some((s) => s.toLowerCase().includes(q))) return false;
  }
  return true;
}

export function snapshotCategoryPage(slug: string, f: CatalogueFilters): CategoryPage | null {
  const category = CATEGORIES.get(slug);
  if (!category) return null;
  const all = snapshotCards(slug);
  let matched = all.filter((p) => matches(p, f));
  // Default order is the catalogue's own, which is how the company lists its range.
  if (f.sort === "name-asc") matched = [...matched].sort((a, b) => a.name.localeCompare(b.name));
  return assembleCategoryPage(
    { id: `${SNAPSHOT_ID_PREFIX}${slug}`, slug, name: category.name, description: category.description, zone: category.zone as ApplicationZone, heroImage: null },
    matched,
    all,
    f,
    { availability: false },
  );
}

export function snapshotProduct(categorySlug: string, productSlug: string): ProductDetail | null {
  const p = PRODUCTS.get(productSlug);
  if (!p || p.categorySlug !== categorySlug) return null;
  return {
    ...toCard(p),
    longDescription: null,
    howToUse: null,
    dilutionGuidance: p.dilutionGuidance.length ? (p.dilutionGuidance as unknown as Prisma.JsonArray) : null,
    dilutionText: p.dilutionText,
    faq: null,
    seoTitle: null,
    seoDescription: null,
    createdAt: CATALOGUE_DATE,
    updatedAt: CATALOGUE_DATE,
    sdsDocument: null,
    coaDocument: null,
    documents: [],
    relatedFrom: [],
    reviews: [],
    ratingSummary: null,
    fromSnapshot: true,
  };
}

/**
 * A small, forgiving product search for when there is no database to run the real one: whole-name
 * matches first, then names containing the query, then every query word found somewhere in the name,
 * description or code.
 */
export function snapshotSearch(q: string, limit: number): Array<{ card: ProductCardData; score: number }> {
  const needle = q.toLowerCase().trim();
  const words = needle.split(/\s+/).filter((w) => w.length > 1);
  const scored: Array<{ p: SnapshotProduct; score: number }> = [];
  for (const p of SNAPSHOT.products) {
    const name = p.name.toLowerCase();
    const rest = `${p.shortDescription} ${p.brand ?? ""} ${p.variants.map((v) => v.sku).join(" ")} ${CATEGORIES.get(p.categorySlug)?.name ?? ""}`.toLowerCase();
    let score = 0;
    if (name === needle) score += 10;
    if (name.includes(needle)) score += 3;
    if (rest.includes(needle)) score += 1;
    const hits = words.filter((w) => name.includes(w) || rest.includes(w)).length;
    if (words.length > 0 && hits === words.length) score += 1 + words.filter((w) => name.includes(w)).length * 0.5;
    if (score > 0) scored.push({ p, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map(({ p, score }) => ({ card: toCard(p), score }));
}
