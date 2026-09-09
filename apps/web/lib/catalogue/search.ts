import { db, Prisma, type DocumentType } from "@safuney/db";
import { ZONES, type ZoneKey } from "@safuney/ui";
import { getCategories } from "@/lib/catalogue";
import { services } from "@/lib/env";
import { VISIBLE_PRODUCT, type ProductCardData } from "./queries";

/*
 * Site search (brief: instant results as you type, typo tolerance, category and document results).
 *
 * Products are ranked in one SQL query over the Product."searchVector" tsvector (migration
 * 20260909070000_constraints_and_search) combined with pg_trgm similarity on the name, so that
 * "degreser" and "sanitzer" still find degreasers and sanitisers. Only active, PO-reviewed products
 * in active categories are ever returned (plan §6.5). User input is only ever passed as a bound
 * parameter of a tagged template; it is never concatenated into SQL.
 */

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;

/** Trim and cap a raw query. Returns "" when it is too short to search. */
export function normaliseQuery(raw: string | null | undefined): string {
  const q = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH).trim();
  return q.length < MIN_QUERY_LENGTH ? "" : q;
}

/** Escape the LIKE metacharacters so a query such as "50%" matches literally. Used with ESCAPE '\'. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  shortDescription: true,
  zone: true,
  hazardClass: true,
  tags: true,
  category: { select: { slug: true, name: true, zone: true, parent: { select: { slug: true } } } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true, width: true, height: true } },
  variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, sku: true, packLabel: true, packSizeValue: true, unit: true, priceMinorUnits: true, compareAtMinorUnits: true, vatRateBps: true, stockOnHand: true, stockReserved: true, lowStockThreshold: true, isMadeToOrder: true, isActive: true, sortOrder: true, weightGrams: true, barcode: true } },
} satisfies Prisma.ProductSelect;

type SearchCard = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

/** A product hit: the card shape used by listings, plus the URL segment of its top-level category. */
export type SearchProduct = ProductCardData & {
  category: SearchCard["category"];
  /** Top-level category slug, i.e. the first segment after /products/. */
  categoryPath: string;
  /** Relevance, higher is better. Full-text rank plus trigram similarity. */
  score: number;
};

export interface SearchCategory {
  id: string;
  slug: string;
  name: string;
  zone: ZoneKey | null;
  href: string;
  /** Visible products in this category and its children. */
  productCount: number;
}

export interface SearchDocument {
  id: string;
  type: DocumentType;
  typeLabel: string;
  title: string;
  version: string;
  href: string;
}

export interface SearchOptions {
  limit?: number;
}

interface RankedRow {
  id: string;
  score: number;
}

/** Products matching `q`, best first. */
export async function searchProducts(rawQ: string, { limit = 24 }: SearchOptions = {}): Promise<SearchProduct[]> {
  const q = normaliseQuery(rawQ);
  if (!q || !services.database()) return [];
  const take = Math.max(1, Math.min(100, Math.floor(limit)));
  const prisma = db();
  const pattern = likePattern(q);

  const ranked = await prisma.$queryRaw<RankedRow[]>`
    WITH query AS (
      SELECT websearch_to_tsquery('english', ${q}::text) AS tsq, ${q}::text AS raw, ${pattern}::text AS pat
    )
    SELECT
      p.id,
      (
        ts_rank_cd(p."searchVector", query.tsq)
        + greatest(similarity(p.name, query.raw), word_similarity(query.raw, p.name))
        + CASE WHEN lower(p.name) = lower(query.raw) THEN 10 ELSE 0 END
        + CASE WHEN p.name ILIKE query.pat ESCAPE '\\' THEN 0.5 ELSE 0 END
      )::float8 AS score
    FROM "Product" p
    JOIN "Category" c ON c.id = p."categoryId"
    CROSS JOIN query
    WHERE p."isActive" = true
      AND p."needsPoReview" = false
      AND c."isActive" = true
      AND (
        p."searchVector" @@ query.tsq
        OR similarity(p.name, query.raw) > 0.25
        OR word_similarity(query.raw, p.name) > 0.4
        OR p.name ILIKE query.pat ESCAPE '\\'
        OR coalesce(p.brand, '') ILIKE query.pat ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM "ProductVariant" v
          WHERE v."productId" = p.id AND v."isActive" = true AND v.sku ILIKE query.pat ESCAPE '\\'
        )
      )
    ORDER BY score DESC, p.name ASC
    LIMIT ${take}
  `;
  if (ranked.length === 0) return [];

  const ids = ranked.map((r) => r.id);
  const cards = await prisma.product.findMany({ where: { id: { in: ids }, ...VISIBLE_PRODUCT }, select: cardSelect });
  const byId = new Map(cards.map((c) => [c.id, c]));
  return ranked.flatMap((r) => {
    const card = byId.get(r.id);
    if (!card) return [];
    return [{ ...card, categoryPath: card.category.parent?.slug ?? card.category.slug, score: Number(r.score) }];
  });
}

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  zone: string;
  productCount: bigint | number;
}

/** Active categories whose name matches `q`, with at least one visible product. */
export async function searchCategories(rawQ: string, { limit = 8 }: SearchOptions = {}): Promise<SearchCategory[]> {
  const q = normaliseQuery(rawQ);
  if (!q || !services.database()) return [];
  const take = Math.max(1, Math.min(50, Math.floor(limit)));
  const pattern = likePattern(q);
  const rows = await db().$queryRaw<CategoryRow[]>`
    SELECT
      c.id, c.slug, c.name, c.zone::text AS zone,
      (
        SELECT count(*) FROM "Product" p
        LEFT JOIN "Category" child ON child.id = p."categoryId"
        WHERE p."isActive" = true AND p."needsPoReview" = false
          AND (p."categoryId" = c.id OR child."parentId" = c.id)
      ) AS "productCount"
    FROM "Category" c
    WHERE c."isActive" = true
      AND (
        c.name ILIKE ${pattern}::text ESCAPE '\\'
        OR similarity(c.name, ${q}::text) > 0.25
        OR word_similarity(${q}::text, c.name) > 0.4
      )
    ORDER BY
      (c.name ILIKE ${pattern}::text ESCAPE '\\') DESC,
      greatest(similarity(c.name, ${q}::text), word_similarity(${q}::text, c.name)) DESC,
      c."sortOrder" ASC
    LIMIT ${take}
  `;
  return rows
    .map((r) => ({ id: r.id, slug: r.slug, name: r.name, zone: r.zone === "NONE" ? null : (r.zone as ZoneKey), href: `/products/${r.slug}`, productCount: Number(r.productCount) }))
    .filter((c) => c.productCount > 0);
}

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  SDS: "Safety data sheet",
  COA: "Certificate of analysis",
  BROCHURE: "Brochure",
  DILUTION_CHART: "Dilution chart",
  CLEANING_SCHEDULE: "Cleaning schedule",
  OTHER: "Document",
};

/** Words people type when they mean a document type. */
const TYPE_KEYWORDS: Array<{ type: DocumentType; words: string[] }> = [
  { type: "SDS", words: ["sds", "msds", "safety data", "safety sheet", "data sheet", "datasheet"] },
  { type: "COA", words: ["coa", "certificate", "analysis"] },
  { type: "BROCHURE", words: ["brochure", "catalogue", "catalog"] },
  { type: "DILUTION_CHART", words: ["dilution", "dilute", "ratio"] },
  { type: "CLEANING_SCHEDULE", words: ["schedule", "checklist", "rota"] },
];

/**
 * Documents whose title matches `q`, or whose type is what `q` names ("sds", "dilution chart").
 * Only current versions, and only documents that belong to visible products or to no product at all,
 * so an unreviewed product's safety data sheet never reveals it.
 */
export async function searchDocuments(rawQ: string, { limit = 8 }: SearchOptions = {}): Promise<SearchDocument[]> {
  const q = normaliseQuery(rawQ);
  if (!q || !services.database()) return [];
  const take = Math.max(1, Math.min(50, Math.floor(limit)));
  const lower = q.toLowerCase();
  const types = TYPE_KEYWORDS.filter((t) => t.words.some((w) => lower.includes(w))).map((t) => t.type);
  const rows = await db().document.findMany({
    where: {
      supersededBy: null,
      AND: [
        { OR: [{ title: { contains: q, mode: "insensitive" } }, ...(types.length ? [{ type: { in: types } }] : [])] },
        {
          OR: [
            { products: { some: { product: VISIBLE_PRODUCT } } },
            { sdsFor: { some: VISIBLE_PRODUCT } },
            { coaFor: { some: VISIBLE_PRODUCT } },
            { AND: [{ products: { none: {} } }, { sdsFor: { none: {} } }, { coaFor: { none: {} } }] },
          ],
        },
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
    take,
    select: { id: true, type: true, title: true, version: true, fileUrl: true },
  });
  return rows.map((d) => ({ id: d.id, type: d.type, typeLabel: DOCUMENT_TYPE_LABEL[d.type], title: d.title, version: d.version, href: d.fileUrl }));
}

export interface SearchSuggestions {
  zones: Array<{ key: ZoneKey; label: string; href: string }>;
  categories: Array<{ slug: string; name: string; href: string }>;
}

/** What to offer when there is nothing to show yet, or nothing matched: the four zones and the fullest categories. */
export async function suggestions(): Promise<SearchSuggestions> {
  const categories = await getCategories();
  const top = [...categories]
    .filter((c) => c.productCount === null || c.productCount > 0)
    .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0))
    .slice(0, 4);
  return {
    zones: ZONES.map((z) => ({ key: z.key, label: z.label, href: `/products?zone=${z.slug}` })),
    categories: top.map((c) => ({ slug: c.slug, name: c.name, href: `/products/${c.slug}` })),
  };
}

/** Everything the results page needs, in parallel. */
export async function searchAll(rawQ: string) {
  const [products, categories, documents] = await Promise.all([searchProducts(rawQ), searchCategories(rawQ), searchDocuments(rawQ)]);
  return { products, categories, documents };
}
