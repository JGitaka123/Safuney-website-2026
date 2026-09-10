import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, cn, zoneMeta } from "@safuney/ui";
import { site } from "@/config/site";
import { rangeImage } from "@/lib/catalogue";
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
import { Crumbs } from "@/components/marketing/crumbs";
import { CtaBand } from "@/components/marketing/cta-band";
import { Icon } from "@/components/marketing/icons";

import cleaningKit from "@/public/brand/cleaning-kit.webp";
import dishwasher from "@/public/brand/dishwasher.webp";
import laundryRoom from "@/public/brand/laundry-room.webp";

type Params = Promise<{ category: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export const revalidate = 300;

/** The catalogue's own general photographs, for the ranges they show. Other ranges show their lead pack. */
const RANGE_PHOTO: Record<string, StaticImageData> = { laundry: laundryRoom, warewashing: dishwasher, housekeeping: cleaningKit };

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

  const [page, mode] = await Promise.all([getCategoryPage(slug, filters), getPriceDisplayMode()]);
  if (!page && !area) notFound();

  const name = page?.category.name ?? area!.name;
  const description = area?.blurb ?? page?.category.description ?? "";
  const base = `/products/${slug}`;
  const query = Object.fromEntries(filtersToSearchParams(filters));
  const count = activeFilterCount(filters);
  const zone = zoneMeta(filters.zone);
  const image = rangeImage(slug);
  const photo = RANGE_PHOTO[slug];
  const zones = area?.zones ?? [];
  const enquiry = `Hello Safuney, please send me prices for your ${name} range.`;

  return (
    <>
      <section aria-labelledby="category-heading" className="on-dark bg-hero">
        <div className="mx-auto grid max-w-page items-center gap-8 px-5 py-10 md:grid-cols-12 md:px-6 md:py-12">
          <div className="md:col-span-8">
            <Crumbs items={[{ href: "/products", label: "Products" }, { label: name }]} />
            <h1 id="category-heading" className="mt-4 text-h1 text-white">
              {name}
            </h1>
            {description ? <p className="mt-3 max-w-[60ch] text-body-lg text-white/75">{description}</p> : null}
            {zones.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Where it is used">
                {zones.map((z) => {
                  const meta = zoneMeta(z);
                  return meta ? (
                    <li key={z} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-caption text-white/85">
                      <span aria-hidden className={cn("size-2 rounded-full", meta.swatch)} />
                      {meta.label}
                    </li>
                  ) : null;
                })}
              </ul>
            ) : null}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={quoteHref({ category: slug })} className={btn.cta}>
                Get prices for this range
                <Icon name="arrowRight" className="size-5" />
              </Link>
              <a href={whatsappHref(enquiry)} target="_blank" rel="noopener noreferrer" className={btn.ghost}>
                <Icon name="whatsapp" className="size-5 text-whatsapp" />
                Ask on WhatsApp
              </a>
            </div>
          </div>
          {photo ? (
            <div aria-hidden className="hidden md:col-span-4 md:block">
              <div className="bg-stage overflow-hidden rounded-[20px] shadow-lift">
                <Image src={photo} alt="" sizes="360px" className="h-auto w-full" />
              </div>
            </div>
          ) : image ? (
            <div aria-hidden className="hidden md:col-span-4 md:block">
              <div className="bg-stage mx-auto grid aspect-square max-w-[17rem] place-items-center rounded-[20px] shadow-lift">
                <Image
                  src={image.url}
                  alt=""
                  width={image.width}
                  height={image.height}
                  sizes="220px"
                  className="h-[80%] w-auto object-contain drop-shadow-[0_12px_16px_rgba(16,32,43,0.2)]"
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
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
                <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
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

      <CtaBand
        id="category-cta"
        title={`Buying ${name.toLowerCase()} for a whole site?`}
        body="Send the quantities. We price it in one working day."
        quoteHref={quoteHref({ category: slug })}
        whatsappText={enquiry}
      />
    </>
  );
}
