import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, ZoneBand, zoneMeta } from "@safuney/ui";
import { site } from "@/config/site";
import { services } from "@/lib/env";
import { activeFilterCount, filtersToSearchParams, parseFilters } from "@/lib/catalogue/filters";
import { getCategoryPage } from "@/lib/catalogue/queries";
import { getPriceDisplayMode } from "@/lib/settings";
import { Facets } from "@/components/catalogue/facets";
import { FiltersSheet } from "@/components/catalogue/filters-sheet";
import { Pagination } from "@/components/catalogue/pagination";
import { ProductGridCard } from "@/components/catalogue/product-grid-card";
import { SortSelect } from "@/components/catalogue/sort-select";
import { Breadcrumbs } from "@/components/site/breadcrumbs";

type Params = Promise<{ category: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category } = await params;
  const area = site.productAreas.find((a) => a.slug === category);
  return {
    title: area ? area.name : "Products",
    description: area?.blurb,
    alternates: { canonical: `/products/${category}` },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { category: slug } = await params;
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const area = site.productAreas.find((a) => a.slug === slug);
  if (!area && !services.database()) notFound();

  const [page, mode] = await Promise.all([getCategoryPage(slug, filters), getPriceDisplayMode()]);
  if (!page && !area) notFound();

  const name = page?.category.name ?? area!.name;
  const description = page?.category.description ?? area?.blurb ?? "";
  const base = `/products/${slug}`;
  const query = Object.fromEntries(filtersToSearchParams(filters));
  const count = activeFilterCount(filters);
  const zone = zoneMeta(filters.zone);

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <Breadcrumbs items={[{ href: "/products", label: "Products" }, { label: name }]} />
      <header className="mt-3 max-w-[62ch]">
        <h1 className="text-h1">{name}</h1>
        {description ? <p className="mt-3 text-ink-muted">{description}</p> : null}
        {area && area.zones.length > 0 ? <ZoneBand zones={area.zones} className="mt-4 max-w-32" /> : null}
      </header>

      {!page ? (
        <div className="mt-10">
          <EmptyState
            heading="Products in this category are being published"
            body="Prices, pack sizes and safety data sheets appear here as each product is reviewed. Ask us now and we will quote the same day."
            actions={[
              <Link key="q" href={`/contact?topic=quote&category=${slug}`} className="inline-flex min-h-11 items-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep">
                Request a quote
              </Link>,
              <a key="c" href={`tel:${site.contact.phone.e164}`} className="inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-5 text-button text-ink">
                Call {site.contact.phone.display}
              </a>,
            ]}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
          <aside aria-label="Filters" className="hidden lg:block">
            <Facets base={base} filters={filters} facets={page.facets} idPrefix="side" />
          </aside>

          <section aria-labelledby="results-heading" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <h2 id="results-heading" className="text-body">
                <span className="tnum font-medium">{page.total}</span> {page.total === 1 ? "product" : "products"}
                {zone ? <span className="text-ink-muted"> for {zone.label.toLowerCase()}</span> : null}
              </h2>
              <div className="flex items-center gap-3">
                <FiltersSheet count={count}>
                  <Facets base={base} filters={filters} facets={page.facets} idPrefix="sheet" />
                </FiltersSheet>
                <SortSelect base={base} value={filters.sort} query={query} />
              </div>
            </div>

            {page.products.length === 0 ? (
              <div className="mt-8">
                <EmptyState
                  heading="Nothing matches all of those filters"
                  body="Remove one, or ask us: we can usually source it."
                  actions={[
                    <Link key="clear" href={base} className="inline-flex min-h-11 items-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep">
                      Clear filters
                    </Link>,
                    <Link key="quote" href={`/contact?topic=quote&category=${slug}`} className="inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-5 text-button text-ink">
                      Request a quote
                    </Link>,
                  ]}
                />
              </div>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
                {page.products.map((p) => (
                  <li key={p.id}>
                    <ProductGridCard product={p} mode={mode} categorySlug={slug} />
                  </li>
                ))}
              </ul>
            )}
            <Pagination base={base} query={query} page={page.page} pageCount={page.pageCount} />
          </section>
        </div>
      )}
    </div>
  );
}
