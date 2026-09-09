import { cache } from "react";
import { db, Prisma, type ApplicationZone } from "@safuney/db";
import type { ZoneKey } from "@safuney/ui";
import { services } from "@/lib/env";
import { PAGE_SIZE, type CatalogueFilters } from "./filters";

/** Only PO-reviewed, active products are ever visible (plan §6.5, brief §5). */
export const VISIBLE_PRODUCT: Prisma.ProductWhereInput = { isActive: true, needsPoReview: false };

const variantSelect = {
  id: true,
  sku: true,
  packLabel: true,
  packSizeValue: true,
  unit: true,
  priceMinorUnits: true,
  compareAtMinorUnits: true,
  vatRateBps: true,
  stockOnHand: true,
  stockReserved: true,
  lowStockThreshold: true,
  isMadeToOrder: true,
  isActive: true,
  sortOrder: true,
  weightGrams: true,
  barcode: true,
} satisfies Prisma.ProductVariantSelect;

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  shortDescription: true,
  zone: true,
  hazardClass: true,
  tags: true,
  category: { select: { slug: true, name: true, zone: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true, width: true, height: true } },
  variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: variantSelect },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;
export type VariantData = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;

export interface CategoryPage {
  category: { id: string; slug: string; name: string; description: string | null; zone: ApplicationZone; heroImage: string | null };
  products: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
  facets: {
    brands: Array<{ value: string; count: number }>;
    packs: Array<{ value: string; count: number }>;
    applications: Array<{ value: string; count: number }>;
    zones: Array<{ value: ZoneKey; count: number }>;
    priceRange: { min: number; max: number } | null;
  };
}

function productWhere(categoryId: string | null, f: CatalogueFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { ...VISIBLE_PRODUCT };
  if (categoryId) where.OR = [{ categoryId }, { category: { parentId: categoryId } }];
  if (f.zone) where.zone = f.zone;
  if (f.brands.length) where.brand = { in: f.brands };
  if (f.applications.length) where.tags = { hasSome: f.applications };
  const variantWhere: Prisma.ProductVariantWhereInput = { isActive: true };
  if (f.packs.length) variantWhere.packLabel = { in: f.packs };
  if (f.priceMin !== undefined) variantWhere.priceMinorUnits = { ...(variantWhere.priceMinorUnits as object), gte: BigInt(f.priceMin) * 100n };
  if (f.priceMax !== undefined) variantWhere.priceMinorUnits = { ...(variantWhere.priceMinorUnits as object), lte: BigInt(f.priceMax) * 100n + 99n };
  if (f.inStock) variantWhere.OR = [{ isMadeToOrder: true }, { stockOnHand: { gt: 0 } }];
  where.variants = { some: variantWhere };
  if (f.q) {
    where.AND = [
      {
        OR: [
          { name: { contains: f.q, mode: "insensitive" } },
          { brand: { contains: f.q, mode: "insensitive" } },
          { shortDescription: { contains: f.q, mode: "insensitive" } },
          { variants: { some: { sku: { contains: f.q, mode: "insensitive" } } } },
        ],
      },
    ];
  }
  return where;
}

function orderBy(f: CatalogueFilters): Prisma.ProductOrderByWithRelationInput[] {
  switch (f.sort) {
    case "name-asc":
      return [{ name: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }, { name: "asc" }];
    // Price sorts are applied after fetching (min variant price); keep a stable base order.
    default:
      return [{ createdAt: "asc" }, { name: "asc" }];
  }
}

function minPrice(p: ProductCardData): bigint {
  const priced = p.variants.filter((v) => v.priceMinorUnits > 0n).map((v) => v.priceMinorUnits);
  return priced.length ? priced.reduce((a, b) => (b < a ? b : a)) : 0n;
}

/** A category listing with facet counts computed over the *unfiltered* category so options never disappear. */
export const getCategoryPage = cache(async (slug: string, f: CatalogueFilters): Promise<CategoryPage | null> => {
  if (!services.database()) return null;
  const prisma = db();
  const category = await prisma.category.findFirst({
    where: { slug, isActive: true },
    select: { id: true, slug: true, name: true, description: true, zone: true, heroImage: true },
  });
  if (!category) return null;

  const where = productWhere(category.id, f);
  const baseWhere = productWhere(category.id, { ...f, zone: undefined, brands: [], packs: [], applications: [], priceMin: undefined, priceMax: undefined, inStock: false });

  const [all, facetProducts] = await Promise.all([
    prisma.product.findMany({ where, orderBy: orderBy(f), select: cardSelect }),
    prisma.product.findMany({ where: baseWhere, select: { brand: true, tags: true, zone: true, variants: { where: { isActive: true }, select: { packLabel: true, priceMinorUnits: true } } } }),
  ]);

  let sorted = all;
  if (f.sort === "price-asc") sorted = [...all].sort((a, b) => Number(minPrice(a) - minPrice(b)));
  if (f.sort === "price-desc") sorted = [...all].sort((a, b) => Number(minPrice(b) - minPrice(a)));

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  const products = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const count = (values: (string | null | undefined)[]) => {
    const m = new Map<string, number>();
    for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
  };
  const prices = facetProducts.flatMap((p) => p.variants.map((v) => v.priceMinorUnits)).filter((p) => p > 0n);
  const zoneCounts = count(facetProducts.map((p) => (p.zone === "NONE" ? null : p.zone))) as Array<{ value: ZoneKey; count: number }>;

  return {
    category,
    products,
    total,
    page,
    pageCount,
    facets: {
      brands: count(facetProducts.map((p) => p.brand)),
      packs: count(facetProducts.flatMap((p) => p.variants.map((v) => v.packLabel))),
      applications: count(facetProducts.flatMap((p) => p.tags)),
      zones: zoneCounts,
      priceRange: prices.length
        ? { min: Number(prices.reduce((a, b) => (b < a ? b : a)) / 100n), max: Number(prices.reduce((a, b) => (b > a ? b : a)) / 100n) + 1 }
        : null,
    },
  };
});

const productSelect = {
  ...cardSelect,
  longDescription: true,
  howToUse: true,
  dilutionGuidance: true,
  dilutionText: true,
  faq: true,
  seoTitle: true,
  seoDescription: true,
  createdAt: true,
  updatedAt: true,
  images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true, width: true, height: true } },
  sdsDocument: { select: { id: true, title: true, version: true, fileUrl: true, publishedAt: true } },
  coaDocument: { select: { id: true, title: true, version: true, fileUrl: true, publishedAt: true } },
  documents: { select: { document: { select: { id: true, type: true, title: true, version: true, fileUrl: true, publishedAt: true } } } },
  relatedFrom: {
    select: { kind: true, to: { select: cardSelect } },
    where: { to: VISIBLE_PRODUCT },
  },
  reviews: {
    where: { isApproved: true },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, rating: true, title: true, body: true, createdAt: true, verifiedOrderId: true, user: { select: { name: true } } },
  },
} satisfies Prisma.ProductSelect;

export type ProductDetail = Prisma.ProductGetPayload<{ select: typeof productSelect }> & {
  ratingSummary: { average: number; count: number } | null;
};

export const getProduct = cache(async (categorySlug: string, productSlug: string): Promise<ProductDetail | null> => {
  if (!services.database()) return null;
  const prisma = db();
  const product = await prisma.product.findFirst({
    where: { slug: productSlug, ...VISIBLE_PRODUCT, OR: [{ category: { slug: categorySlug } }, { category: { parent: { slug: categorySlug } } }] },
    select: productSelect,
  });
  if (!product) return null;
  const agg = await prisma.review.aggregate({ where: { productId: product.id, isApproved: true }, _avg: { rating: true }, _count: { _all: true } });
  return {
    ...product,
    ratingSummary: agg._count._all > 0 ? { average: Math.round((agg._avg.rating ?? 0) * 10) / 10, count: agg._count._all } : null,
  };
});

/** Slugs for static generation of product pages. */
export async function listVisibleProductPaths(): Promise<Array<{ category: string; product: string }>> {
  if (!services.database()) return [];
  const rows = await db().product.findMany({ where: VISIBLE_PRODUCT, select: { slug: true, category: { select: { slug: true, parent: { select: { slug: true } } } } } });
  return rows.map((r) => ({ category: r.category.parent?.slug ?? r.category.slug, product: r.slug }));
}

/** Every visible product with its variants, for the B2B order sheet. */
export const listOrderSheet = cache(async (): Promise<ProductCardData[]> => {
  if (!services.database()) return [];
  return db().product.findMany({ where: VISIBLE_PRODUCT, orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }], select: cardSelect });
});

export function stockStatus(v: Pick<VariantData, "stockOnHand" | "stockReserved" | "lowStockThreshold" | "isMadeToOrder">): { key: "in" | "low" | "mto" | "out"; label: string } {
  const available = v.stockOnHand - v.stockReserved;
  if (available > v.lowStockThreshold) return { key: "in", label: "In stock" };
  if (available > 0) return { key: "low", label: `Low stock: ${available} left` };
  if (v.isMadeToOrder) return { key: "mto", label: "Made to order" };
  return { key: "out", label: "Out of stock" };
}
