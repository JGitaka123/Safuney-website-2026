import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZoneBadge, zoneMeta } from "@safuney/ui";
import { getCategories } from "@/lib/catalogue";
import { whatsappHref } from "@/lib/contact";
import { INDUSTRIES, industryBySlug } from "@/lib/content/solutions";
import { breadcrumbJsonLd, faqJsonLd, jsonLdString } from "@/lib/seo/jsonld";
import { btn } from "@/components/marketing/buttons";
import { Crumbs } from "@/components/marketing/crumbs";
import { CtaBand } from "@/components/marketing/cta-band";
import { Icon } from "@/components/marketing/icons";
import { INDUSTRY_ICON } from "@/components/marketing/industry-icons";
import { RangeGrid } from "@/components/marketing/range-grid";
import Link from "next/link";

type Params = Promise<{ industry: string }>;

export function generateStaticParams() {
  return INDUSTRIES.map((i) => ({ industry: i.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const industry = industryBySlug((await params).industry);
  if (!industry) return { title: "Solutions" };
  return {
    title: `${industry.name} cleaning and hygiene`,
    description: industry.summary,
    // No hreflang: there is no Swahili edition of this page yet (only /sw exists).
    alternates: { canonical: `/solutions/${industry.slug}` },
    openGraph: { title: `${industry.name} cleaning and hygiene`, description: industry.summary },
  };
}

export default async function IndustryPage({ params }: { params: Params }) {
  const industry = industryBySlug((await params).industry);
  if (!industry) notFound();

  // Only ranges that actually hold something a customer can buy: a link to an empty shelf is worse
  // than no link.
  const categories = (await getCategories()).filter((c) => (c.productCount ?? 0) > 0);
  const ordered = industry.categories.map((slug) => categories.find((c) => c.slug === slug)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const enquiry = `Hello Safuney, I would like a cleaning programme for our ${industry.name.toLowerCase()} site.`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Solutions", path: "/solutions" }, { name: industry.name, path: `/solutions/${industry.slug}` }]),
            faqJsonLd(industry.faq),
          ]),
        }}
      />

      <section aria-labelledby="industry-heading" className="on-dark bg-hero">
        <div className="mx-auto max-w-page px-5 py-12 md:px-6 md:py-16">
          <Crumbs items={[{ href: "/solutions", label: "Solutions" }, { label: industry.name }]} />
          <div className="mt-5 flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-brand-lime">
              <Icon name={INDUSTRY_ICON[industry.slug] ?? "building"} className="size-7" />
            </span>
            <h1 id="industry-heading" className="text-hero text-white">
              {industry.name}
            </h1>
          </div>
          <p className="mt-5 max-w-[56ch] text-body-lg text-white/75">{industry.summary}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={`/quote?context=${industry.slug}`} className={btn.cta}>
              Get a programme quote
              <Icon name="arrowRight" className="size-5" />
            </Link>
            <a href={whatsappHref(enquiry)} target="_blank" rel="noopener noreferrer" className={btn.ghost}>
              <Icon name="whatsapp" className="size-5 text-whatsapp" />
              Ask on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-page px-5 py-12 md:px-6 md:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <p className="text-body-lg text-ink lg:col-span-7">{industry.intro}</p>
          <section aria-labelledby="zones" className="lg:col-span-5">
            <h2 id="zones" className="text-h3">
              Zones you clean
            </h2>
            <ul className="mt-4 grid gap-3">
              {industry.zones.map((z) => {
                const meta = zoneMeta(z);
                return (
                  <li key={z} className="rounded-card border border-line bg-surface p-4">
                    <ZoneBadge zone={z} />
                    {meta ? <p className="mt-2 text-small text-ink-muted">{meta.meaning}</p> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {ordered.length > 0 ? (
          <section aria-labelledby="buys" className="mt-16">
            <h2 id="buys" className="text-h2">
              What this setting buys
            </h2>
            <RangeGrid categories={ordered} className="mt-6" />
          </section>
        ) : null}

        <section aria-labelledby="asks" className="mt-16">
          <h2 id="asks" className="text-h2">
            What buyers in {industry.name.toLowerCase()} ask
          </h2>
          <div className="faq mt-6 divide-y divide-line rounded-card border border-line bg-surface">
            {industry.faq.map((f) => (
              <details key={f.q} className="px-5 md:px-6">
                <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3 text-h4 text-ink">
                  {f.q}
                  <span aria-hidden className="faq-sign text-h2 leading-none text-accent transition-transform">
                    +
                  </span>
                </summary>
                <p className="pb-5 text-body text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <CtaBand
        id="industry-cta"
        title="Talk to someone who knows the setting."
        body="Send us your site list and what you clean today. We come back with a product list, the dilutions and a price, not a brochure."
        quoteHref={`/quote?context=${industry.slug}`}
        whatsappText={enquiry}
      />
    </>
  );
}
