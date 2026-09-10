import type { ZoneKey } from "@safuney/ui";
import { PAGE_SIZE, type CatalogueFilters } from "./filters";
import type { CategoryPage, ProductCardData } from "./queries";

/** What facet counts are computed from: the category's products with no filters applied. */
export interface FacetSource {
  brand: string | null;
  tags: string[];
  zone: string;
  variants: Array<{ packLabel: string; priceMinorUnits: bigint }>;
}

export function minPrice(p: Pick<ProductCardData, "variants">): bigint {
  const priced = p.variants.filter((v) => v.priceMinorUnits > 0n).map((v) => v.priceMinorUnits);
  return priced.length ? priced.reduce((a, b) => (b < a ? b : a)) : 0n;
}

function count(values: Array<string | null | undefined>) {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([value, n]) => ({ value, count: n })).sort((a, b) => a.value.localeCompare(b.value));
}

/**
 * Sort, paginate and count facets for one category listing.
 *
 * Shared by the database path and the catalogue snapshot (ADR 0017) so a listing behaves the same
 * whichever one it came from. Facets are counted over the unfiltered category so options never
 * disappear as filters are applied. A pack label with no number in it ("each", "Pack size on
 * request") is not a size, so it is never offered as a pack-size filter.
 */
export function assembleCategoryPage(
  category: CategoryPage["category"],
  matched: ProductCardData[],
  facetProducts: FacetSource[],
  f: CatalogueFilters,
  { availability = true }: { availability?: boolean } = {},
): CategoryPage {
  let sorted = matched;
  if (f.sort === "price-asc") sorted = [...matched].sort((a, b) => Number(minPrice(a) - minPrice(b)));
  if (f.sort === "price-desc") sorted = [...matched].sort((a, b) => Number(minPrice(b) - minPrice(a)));

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  const products = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const prices = facetProducts.flatMap((p) => p.variants.map((v) => v.priceMinorUnits)).filter((p) => p > 0n);

  return {
    category,
    products,
    total,
    page,
    pageCount,
    facets: {
      brands: count(facetProducts.map((p) => p.brand)),
      packs: count(facetProducts.flatMap((p) => p.variants.map((v) => v.packLabel)).filter((label) => /\d/.test(label))),
      applications: count(facetProducts.flatMap((p) => p.tags)),
      zones: count(facetProducts.map((p) => (p.zone === "NONE" ? null : p.zone))) as Array<{ value: ZoneKey; count: number }>,
      priceRange: prices.length
        ? { min: Number(prices.reduce((a, b) => (b < a ? b : a)) / 100n), max: Number(prices.reduce((a, b) => (b > a ? b : a)) / 100n) + 1 }
        : null,
      availability,
    },
  };
}
