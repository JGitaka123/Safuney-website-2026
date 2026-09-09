import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hazardLabel, type HazardClass, type ZoneKey } from "@safuney/ui";
import { MAX_QUERY_LENGTH, searchCategories, searchDocuments, searchProducts } from "@/lib/catalogue/search";
import { fromPrice } from "@/lib/pricing";
import { createMemoryRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { getPriceDisplayMode } from "@/lib/settings";
import type { SearchApiResponse } from "@/components/search/types";

/*
 * GET /api/search?q= — instant results for the header search box.
 * Prices are formatted here; the client never sees minor units as numbers.
 * 60 requests a minute per IP; results are cacheable per browser for 30 seconds.
 */

export const dynamic = "force-dynamic";

const SEARCH_RATE_LIMIT = { max: 60, windowMs: 60 * 1000 } as const;

const LIMITS = { products: 8, categories: 4, documents: 4 } as const;

const querySchema = z.object({ q: z.string().max(MAX_QUERY_LENGTH) });

const globalForLimiter = globalThis as unknown as { __safuneySearchLimiter?: RateLimiter };

function limiter(): RateLimiter {
  if (!globalForLimiter.__safuneySearchLimiter) globalForLimiter.__safuneySearchLimiter = createMemoryRateLimiter(SEARCH_RATE_LIMIT);
  return globalForLimiter.__safuneySearchLimiter;
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rate = await limiter().limit(clientIp(req));
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Too many searches in a minute. Wait ${rate.retryAfterSeconds} seconds and try again.` },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds), "cache-control": "no-store" } },
    );
  }

  const parsed = querySchema.safeParse({ q: req.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: `Search text is too long. Use up to ${MAX_QUERY_LENGTH} characters.` }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const q = parsed.data.q.trim();

  const [products, categories, documents, mode] = await Promise.all([
    searchProducts(q, { limit: LIMITS.products }),
    searchCategories(q, { limit: LIMITS.categories }),
    searchDocuments(q, { limit: LIMITS.documents }),
    getPriceDisplayMode(),
  ]);

  const body: SearchApiResponse = {
    q,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      href: `/products/${p.categoryPath}/${p.slug}`,
      categoryName: p.category.name,
      packs: p.variants.map((v) => v.packLabel),
      priceLabel: fromPrice(p.variants, mode)?.label ?? null,
      zone: p.zone === "NONE" ? null : (p.zone as ZoneKey),
      hazard: p.hazardClass as HazardClass,
      hazardLabel: p.hazardClass === "NONE" ? null : hazardLabel[p.hazardClass as HazardClass],
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, href: c.href, productCount: c.productCount })),
    documents: documents.map((d) => ({ id: d.id, title: d.title, typeLabel: d.typeLabel, href: d.href })),
  };

  return NextResponse.json(body, { headers: { "cache-control": "private, max-age=30", vary: "cookie" } });
}
