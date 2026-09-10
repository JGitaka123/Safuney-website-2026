import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, cn, zoneMeta } from "@safuney/ui";
import { site } from "@/config/site";
import { activeFilterCount, filtersToSearchParams, parseFilters } from "@/lib/catalogue/filters";
import { getCategoryPage } from "@/lib/catalogue/queries";
import { quoteHref, telHref, whatsappHref } from "@/lib/contact";
import { getPriceDisplayMode } from "@/lib/settings";
import { Facets } from "@/components/catalogue/facets";
import { FiltersSheet } from "@/components/catalogue/filters-sheet";
import { Pagination } from "@/components/catalogue/pagination";
import { ProductGridCard } from "@/components/catalogue/product-grid-card";
import { SortSelect } from "@/components/catalogue/sort-select";
import { btn } from "@/components/marketing/buttons";
import { Icon } from "@/components/marketing/icons";
import { rangeMeta } from "@/components/marketing/range-meta";
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

/**
 * A range page, laid out on Alliance Chemical's collection page: a light header with the breadcrumb,
 * the name and one line; a row of tabs across the ranges; filters on the left; the grid on the right.
 * The first row of cards loads its pictures eagerly — on a phone the first card is the largest thing
 * on screen, and a lazy one is what pushed LCP past the 2 s budget.
 */
export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { category: slug } = await params;
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const area = site.productAreas.find((a) => a.slug === slug);

  const [page, mode] = await Promise.all([getCategoryPage(slug, filters), getPriceDisplayMode()]);
  if (!page && !area) notFound();

  const name = page?.category.name ?? area!.name;
  const description = area?.blurb ?? page?.category.description ?? "";
  const base = `/products/${slug}`;
  const query = Object.fromEntries(filtersToSearchParams(filters));
  const count = activeFilterCount(filters);
  const zone = zoneMeta(filters.zone);
  const enquiry = `Hello Safuney, please send me prices for your ${name} range.`;

  return (
    <>
      <section aria-labelledby="category-heading" className="border-b border-line bg-ground-deep/60">
        <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-10">
          <Breadcrumbs items={[{ href: "/products", label: "Products" }, { label: name }]} />
          <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-[62ch]">
              <h1 id="category-heading" className="text-h1">
                {name}
              </h1>
              {description ? <p className="mt-2 text-body-lg text-ink-muted">{description}</p> : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={quoteHref({ category: slug })} className={`${btn.brand} ${btn.sm}`}>
                Request a quote
              </Link>
              <a href={whatsappHref(enquiry)} target="_blank" rel="noopener noreferrer" className={`${btn.outline} ${btn.sm}`}>
                <Icon name="whatsapp" className="size-4" />
                Order on WhatsApp
              </a>
            </div>
          </div>
        </div>
        <nav aria-label="Ranges" className="border-t border-line bg-surface">
          <ul className="mx-auto flex max-w-page gap-7 overflow-x-auto px-5 md:px-6">
            {site.productAreas.map((a) => {
              const current = a.slug === slug;
              return (
                <li key={a.slug} className="shrink-0">
                  <Link
                    href={`/products/${a.slug}`}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-12 items-center whitespace-nowrap border-b-2 text-small font-semibold uppercase tracking-wide",
                      current ? "border-accent text-accent" : "border-transparent text-ink-muted hover:text-ink",
                    )}
                  >
                    {rangeMeta(a.slug).short}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </section>

      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-10">
        {!page ? (
          <EmptyState
            headingLevel={2}
            heading={`Ask us for ${name.toLowerCase()}`}
            body="Tell us what you need and how much. We price it within one working day."
            actions={[
              <Link key="q" href={quoteHref({ category: slug })} className={btn.cta}>
                Get a quote
              </Link>,
              <a key="c" href={telHref} className={btn.secondary}>
                Call {site.contact.phone.display}
              </a>,
            ]}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
            <aside aria-label="Filters" className="hidden lg:block">
              <p className="mb-4 flex items-center gap-2 border-b border-line pb-3 text-small font-semibold uppercase tracking-wide text-ink">
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                Filters
              </p>
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
                      <Link key="clear" href={base} className={btn.primary}>
                        Clear filters
                      </Link>,
                      <Link key="quote" href={quoteHref({ category: slug })} className={btn.secondary}>
                        Request a quote
                      </Link>,
                    ]}
                  />
                </div>
              ) : (
                <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5">
                  {page.products.map((p, i) => (
                    <li key={p.id}>
                      <ProductGridCard product={p} mode={mode} categorySlug={slug} priority={i < 3} />
                    </li>
                  ))}
                </ul>
              )}
              <Pagination base={base} query={query} page={page.page} pageCount={page.pageCount} />

              <div className="mt-10 flex flex-col gap-4 rounded-card border border-line bg-surface p-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-h4 text-ink">Buying {name.toLowerCase()} for a whole site?</p>
                  <p className="mt-1 text-small text-ink-muted">Send the quantities. We price it within one working day.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={quoteHref({ category: slug })} className={`${btn.cta} ${btn.sm}`}>
                    Request a quote
                  </Link>
                  <a href={telHref} className={`${btn.secondary} ${btn.sm}`}>
                    <Icon name="phone" className="size-4" />
                    {site.contact.phone.display}
                  </a>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
