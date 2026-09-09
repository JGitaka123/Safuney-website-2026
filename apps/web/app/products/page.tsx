import type { Metadata } from "next";
import Link from "next/link";
import { ZONES, ZoneBand, zoneMeta } from "@safuney/ui";
import { getCategories, getZoneCounts } from "@/lib/catalogue";
import { ZoneBar } from "@/components/site/zone-bar";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Cleaning and hygiene chemicals by application: foodservice, disinfection, laundry, housekeeping, healthcare, laboratory, specialty and personal hygiene.",
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ zone?: string }> }) {
  const { zone } = await searchParams;
  const selected = zoneMeta(zone);
  const [categories, counts] = await Promise.all([getCategories(), getZoneCounts()]);
  const shown = selected ? categories.filter((c) => c.zones.includes(selected.key)) : categories;

  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
        <Link href="/" className="hover:underline underline-offset-[3px]">
          Home
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Products</span>
      </nav>
      <h1 className="mt-3 text-h1">Products</h1>
      <p className="mt-3 max-w-[62ch] text-ink-muted">
        Cleaning and hygiene chemicals by application. Prices, pack sizes, dilution ratios and safety data sheets appear
        on each product as the catalogue is published. Until then, request a quote and we will price it the same day.
      </p>

      <section aria-labelledby="zone-filter" className="mt-10">
        <h2 id="zone-filter" className="text-h3">
          Where will you use it?
        </h2>
        <div className="mt-4">
          <ZoneBar counts={counts} />
        </div>
        {selected ? (
          <p className="mt-4 text-small">
            Showing categories for <strong>{selected.label}</strong>.{" "}
            <Link href="/products" className="text-accent underline underline-offset-[3px]">
              Show all categories
            </Link>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="categories" className="mt-12">
        <h2 id="categories" className="text-h3">
          {selected ? `Categories for ${selected.label.toLowerCase()}` : "All categories"}
        </h2>
        {shown.length === 0 ? (
          <p className="mt-4 max-w-[62ch]">
            Nothing is filed under {selected?.label.toLowerCase()} yet.{" "}
            <Link href="/contact?topic=quote" className="text-accent underline underline-offset-[3px]">
              Ask us and we will usually source it
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 grid border-t border-line md:grid-cols-2 md:gap-x-12">
            {shown.map((c) => (
              <li key={c.slug} id={c.slug} className="scroll-mt-20 border-b border-line py-5">
                <h3 className="text-h4">{c.name}</h3>
                <p className="mt-1 text-small text-ink-muted">{c.blurb}</p>
                {c.zones.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-ink-muted">
                    <ZoneBand zones={c.zones} className="max-w-24" />
                    <span>Use in: {c.zones.map((z) => ZONES.find((m) => m.key === z)?.label).join(", ")}</span>
                  </div>
                ) : null}
                <p className="mt-3 text-small">
                  {typeof c.productCount === "number" && c.productCount > 0 ? (
                    <span className="tnum">{c.productCount} products listed.</span>
                  ) : (
                    <Link href={`/contact?topic=quote&category=${c.slug}`} className="text-accent underline underline-offset-[3px]">
                      Request a quote for {c.name.toLowerCase()}
                    </Link>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
