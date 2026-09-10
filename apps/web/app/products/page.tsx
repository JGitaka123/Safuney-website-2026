import type { Metadata } from "next";
import Link from "next/link";
import { ZONES, cn, zoneMeta } from "@safuney/ui";
import { site } from "@/config/site";
import { getCategories, getProductsBySlug } from "@/lib/catalogue";
import { whatsappHref } from "@/lib/contact";
import { getPriceDisplayMode } from "@/lib/settings";
import { ProductGridCard } from "@/components/catalogue/product-grid-card";
import { btn } from "@/components/marketing/buttons";
import { Crumbs } from "@/components/marketing/crumbs";
import { CtaBand } from "@/components/marketing/cta-band";
import { Icon } from "@/components/marketing/icons";
import { RangeGrid } from "@/components/marketing/range-grid";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Cleaning and hygiene products by application: warewashing, disinfection, speciality, personal hygiene, housekeeping, process hygiene, laundry, the Bactro biological range, and cleaning equipment.",
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ zone?: string }> }) {
  const { zone } = await searchParams;
  const selected = zoneMeta(zone);
  const [categories, featured, mode] = await Promise.all([getCategories(), getProductsBySlug(site.featuredProducts), getPriceDisplayMode()]);
  const shown = selected ? categories.filter((c) => c.zones.includes(selected.key)) : categories;
  const total = categories.reduce((n, c) => n + (c.productCount ?? 0), 0);

  return (
    <>
      <section aria-labelledby="products-heading" className="on-dark bg-hero">
        <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-12">
          <Crumbs items={[{ label: "Products" }]} />
          <h1 id="products-heading" className="mt-4 text-h1 text-white">
            Products
          </h1>
          <p className="mt-2 text-body-lg text-white/75">
            {total} products in {categories.length} ranges. Priced in one working day.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/quote" className={btn.cta}>
              Get a quote
              <Icon name="arrowRight" className="size-5" />
            </Link>
            <a href={whatsappHref("Hello Safuney, here is my product list for a quote:")} target="_blank" rel="noopener noreferrer" className={btn.ghost}>
              <Icon name="whatsapp" className="size-5 text-whatsapp" />
              Send your list on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-14">
        <section aria-labelledby="zone-filter">
          <h2 id="zone-filter" className="text-h4">
            Where will you use it?
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {ZONES.map((z) => {
              const active = selected?.key === z.key;
              return (
                <li key={z.key}>
                  <Link
                    href={active ? "/products" : `/products?zone=${z.slug}`}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-small font-medium text-ink",
                      active ? "border-2 border-accent bg-accent-wash" : "border-line bg-surface hover:border-stainless",
                    )}
                  >
                    <span aria-hidden className={cn("size-2.5 rounded-full", z.swatch)} />
                    {z.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {selected ? (
            <p className="mt-4 text-small">
              Showing categories for <strong>{selected.label}</strong>.{" "}
              <Link href="/products" className="text-accent underline underline-offset-[3px]">
                Show all categories
              </Link>
            </p>
          ) : null}
        </section>

        <section aria-labelledby="categories" className="mt-10">
          <h2 id="categories" className="text-h2">
            {selected ? `Ranges for ${selected.label.toLowerCase()}` : "All ranges"}
          </h2>
          {shown.length === 0 ? (
            <p className="mt-4 max-w-[62ch]">
              Nothing is filed under {selected?.label.toLowerCase()} yet.{" "}
              <Link href="/quote" className="text-accent underline underline-offset-[3px]">
                Ask us and we will usually source it
              </Link>
              .
            </p>
          ) : (
            <RangeGrid categories={shown} className="mt-6" />
          )}
        </section>

        {!selected && featured.length > 0 ? (
          <section aria-labelledby="essentials" className="mt-16">
            <h2 id="essentials" className="text-h2">
              The essentials
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {featured.map((p) => (
                <li key={p.id}>
                  <ProductGridCard product={p} mode={mode} categorySlug={p.category.slug} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <CtaBand title="Can't see it? We can usually source it." body="Send the product or brand you use today." />
    </>
  );
}
