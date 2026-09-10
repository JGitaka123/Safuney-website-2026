import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ZoneBadge } from "@safuney/ui";
import { normaliseQuery, searchAll, suggestions, MIN_QUERY_LENGTH, type SearchSuggestions } from "@/lib/catalogue/search";
import { getPriceDisplayMode } from "@/lib/settings";
import { ProductGridCard } from "@/components/catalogue/product-grid-card";
import { SearchBox } from "@/components/search/search-box";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { btn } from "@/components/marketing/buttons";

type Search = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

const tile = "flex min-h-12 items-center rounded-card border border-line bg-surface px-4 shadow-card transition hover:border-stainless hover:shadow-lift";

function rawQuery(params: Record<string, string | string[] | undefined>): string {
  const v = params["q"];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const q = normaliseQuery(rawQuery(await searchParams));
  return {
    title: q ? `Search results for '${q}'` : "Search",
    robots: { index: false, follow: false },
  };
}

function Suggestions({ s }: { s: SearchSuggestions }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="text-label text-ink-muted">Browse by zone</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {s.zones.map((z) => (
            <li key={z.key}>
              <Link href={z.href} className={`${tile} gap-3`}>
                <ZoneBadge zone={z.key} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {s.categories.length > 0 ? (
        <div>
          <h3 className="text-label text-ink-muted">Browse by range</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {s.categories.map((c) => (
              <li key={c.slug}>
                <Link href={c.href} className={`${tile} text-body text-ink`}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Search }) {
  const raw = rawQuery(await searchParams).trim();
  const q = normaliseQuery(raw);

  if (!q) {
    const s = await suggestions();
    return (
      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
        <Breadcrumbs items={[{ label: "Search" }]} />
        <h1 className="mt-3 text-h1">Search</h1>
        <div className="mt-6 max-w-xl">
          <SearchBox layout="inline" labelVisible autoFocus={raw.length > 0} landmarkLabel="Search the catalogue" />
        </div>
        <div className="mt-8 max-w-3xl">
          <EmptyState
            headingLevel={2}
            heading={raw.length > 0 ? `Type at least ${MIN_QUERY_LENGTH} characters to search` : "What are you looking for?"}
            body="Search by product name or code, or start with a zone or a range."
          >
            <Suggestions s={s} />
          </EmptyState>
        </div>
      </div>
    );
  }

  const [{ products, categories, documents }, mode] = await Promise.all([searchAll(q), getPriceDisplayMode()]);
  const total = products.length + categories.length + documents.length;
  const closest = categories[0];

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <Breadcrumbs items={[{ label: "Search" }]} />
      <h1 className="mt-3 text-h1 [overflow-wrap:anywhere]">Search results for &apos;{q}&apos;</h1>
      <div className="mt-6 max-w-xl">
        <SearchBox layout="popover" labelVisible landmarkLabel="Search again" />
      </div>

      {total === 0 ? (
        <div className="mt-8 max-w-3xl">
          <EmptyState
            headingLevel={2}
            heading={`No products found for '${q}'`}
            body={
              <>
                Check the spelling, or browse{" "}
                <Link href={closest?.href ?? "/products"} className="text-accent underline underline-offset-[3px]">
                  {closest?.name ?? "all products"}
                </Link>
                . We can usually source what is not listed.
              </>
            }
            actions={[
              <Link key="quote" href={`/quote?q=${encodeURIComponent(q)}`} className={btn.cta}>
                Request a quote
              </Link>,
              <Link key="products" href="/products" className={btn.secondary}>
                Browse all products
              </Link>,
            ]}
          >
            <Suggestions s={await suggestions()} />
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-12">
          <section aria-labelledby="results-products">
            <h2 id="results-products" className="border-b border-line pb-3 text-h3">
              <span className="tnum">{products.length}</span> {products.length === 1 ? "product" : "products"}
            </h2>
            {products.length === 0 ? (
              <p className="mt-4 max-w-[62ch] text-body text-ink-muted">
                No products match &apos;{q}&apos;, but the ranges and documents below might.{" "}
                <Link href={`/quote?q=${encodeURIComponent(q)}`} className="text-accent underline underline-offset-[3px]">
                  Ask us for a quote
                </Link>{" "}
                if you cannot find it.
              </p>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => (
                  <li key={p.id}>
                    <ProductGridCard product={p} mode={mode} categorySlug={p.categoryPath} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {categories.length > 0 ? (
            <section aria-labelledby="results-categories">
              <h2 id="results-categories" className="border-b border-line pb-3 text-h3">
                <span className="tnum">{categories.length}</span> {categories.length === 1 ? "range" : "ranges"}
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link href={c.href} className={`${tile} justify-between gap-3`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="text-body text-ink">{c.name}</span>
                        {c.zone ? <ZoneBadge zone={c.zone} /> : null}
                      </span>
                      <span className="tnum shrink-0 text-small text-ink-muted">
                        {c.productCount} {c.productCount === 1 ? "product" : "products"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {documents.length > 0 ? (
            <section aria-labelledby="results-documents">
              <h2 id="results-documents" className="border-b border-line pb-3 text-h3">
                <span className="tnum">{documents.length}</span> {documents.length === 1 ? "document" : "documents"}
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {documents.map((d) => (
                  <li key={d.id}>
                    <a href={d.href} className={`${tile} flex-col items-start justify-center py-2`}>
                      <span className="text-body text-ink">{d.title}</span>
                      <span className="text-caption text-ink-muted">
                        {d.typeLabel}, version {d.version}, PDF
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
