import { zoneMeta, type ZoneKey } from "@safuney/ui";

/** Sort options for category listings. Keys are what appears in the URL. */
export const SORTS = {
  relevance: { label: "Relevance" },
  "name-asc": { label: "Name, A to Z" },
  "price-asc": { label: "Price, low to high" },
  "price-desc": { label: "Price, high to low" },
  newest: { label: "Newest" },
} as const;
export type SortKey = keyof typeof SORTS;

export interface CatalogueFilters {
  zone?: ZoneKey;
  brands: string[];
  /** Pack labels such as "5 L" */
  packs: string[];
  /** Product tags used as "application" facets */
  applications: string[];
  /** KES whole shillings, inclusive bounds */
  priceMin?: number;
  priceMax?: number;
  inStock: boolean;
  sort: SortKey;
  page: number;
  q?: string;
}

export const PAGE_SIZE = 24;

type Params = Record<string, string | string[] | undefined>;

function list(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : v.split(",");
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))].slice(0, 20);
}

function int(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/** Parse URL search params into a validated filter object. Unknown or malformed values are dropped, never thrown. */
export function parseFilters(params: Params): CatalogueFilters {
  const zoneParam = Array.isArray(params["zone"]) ? params["zone"][0] : params["zone"];
  const sortParam = (Array.isArray(params["sort"]) ? params["sort"][0] : params["sort"]) ?? "relevance";
  const page = int(params["page"]) ?? 1;
  const q = (Array.isArray(params["q"]) ? params["q"][0] : params["q"])?.trim().slice(0, 100) || undefined;
  let priceMin = int(params["min"]);
  let priceMax = int(params["max"]);
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];
  return {
    zone: zoneMeta(zoneParam)?.key,
    brands: list(params["brand"]),
    packs: list(params["pack"]),
    applications: list(params["application"]),
    priceMin,
    priceMax,
    inStock: params["stock"] === "in",
    sort: sortParam in SORTS ? (sortParam as SortKey) : "relevance",
    page: Math.max(1, page),
    q,
  };
}

/** Serialise filters back to a query string (stable key order, omits defaults) so URLs are shareable. */
export function filtersToSearchParams(f: Partial<CatalogueFilters>): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.zone) sp.set("zone", zoneMeta(f.zone)?.slug ?? f.zone);
  if (f.brands?.length) sp.set("brand", f.brands.join(","));
  if (f.packs?.length) sp.set("pack", f.packs.join(","));
  if (f.applications?.length) sp.set("application", f.applications.join(","));
  if (f.priceMin !== undefined) sp.set("min", String(f.priceMin));
  if (f.priceMax !== undefined) sp.set("max", String(f.priceMax));
  if (f.inStock) sp.set("stock", "in");
  if (f.sort && f.sort !== "relevance") sp.set("sort", f.sort);
  if (f.page && f.page > 1) sp.set("page", String(f.page));
  return sp;
}

/** Toggle one value in a multi-select facet and return the new URL query string. Resets the page. */
export function toggleFacet(f: CatalogueFilters, key: "brands" | "packs" | "applications", value: string): string {
  const current = new Set(f[key]);
  if (current.has(value)) current.delete(value);
  else current.add(value);
  return filtersToSearchParams({ ...f, [key]: [...current], page: 1 }).toString();
}

export function withFilter(f: CatalogueFilters, patch: Partial<CatalogueFilters>): string {
  return filtersToSearchParams({ ...f, page: 1, ...patch }).toString();
}

export function activeFilterCount(f: CatalogueFilters): number {
  return (f.zone ? 1 : 0) + f.brands.length + f.packs.length + f.applications.length + (f.priceMin !== undefined || f.priceMax !== undefined ? 1 : 0) + (f.inStock ? 1 : 0);
}
