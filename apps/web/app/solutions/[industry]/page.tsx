import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@safuney/db";
import { ButtonLink, ZoneBadge, zoneMeta } from "@safuney/ui";
import { services } from "@/lib/env";
import { INDUSTRIES, industryBySlug } from "@/lib/content/solutions";
import { breadcrumbJsonLd, faqJsonLd, jsonLdString } from "@/lib/seo/jsonld";

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
    alternates: { canonical: `/solutions/${industry.slug}`, languages: { en: `/solutions/${industry.slug}`, sw: `/sw/solutions/${industry.slug}` } },
    openGraph: { title: `${industry.name} cleaning and hygiene`, description: industry.summary },
  };
}

export default async function IndustryPage({ params }: { params: Params }) {
  const industry = industryBySlug((await params).industry);
  if (!industry) notFound();

  // Only categories that actually hold something a customer can buy: a link to an empty shelf is worse
  // than no link, and the catalogue is still being reviewed.
  const categories = services.database()
    ? await db().category.findMany({
        where: { slug: { in: [...industry.categories] }, isActive: true, products: { some: { isActive: true, needsPoReview: false } } },
        select: { slug: true, name: true, description: true, _count: { select: { products: { where: { isActive: true, needsPoReview: false } } } } },
      })
    : [];
  const ordered = industry.categories.map((slug) => categories.find((c) => c.slug === slug)).filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Solutions", path: "/solutions" }, { name: industry.name, path: `/solutions/${industry.slug}` }]),
            faqJsonLd(industry.faq),
          ]),
        }}
      />
      <nav aria-label="Breadcrumb" className="text-caption text-ink-muted">
        <Link href="/solutions" className="underline hover:text-ink">
          Solutions
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{industry.name}</span>
      </nav>

      <h1 className="mt-3 text-h1">{industry.name}</h1>
      <p className="mt-3 max-w-reading text-body-lg text-ink-muted">{industry.summary}</p>
      <p className="mt-5 max-w-reading text-body text-ink">{industry.intro}</p>

      <section className="mt-8">
        <h2 className="text-h3">Zones you clean</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {industry.zones.map((z) => {
            const meta = zoneMeta(z)!;
            return (
              <li key={z} className="border border-line bg-surface p-4">
                <ZoneBadge zone={z} />
                <p className="mt-2 text-body text-ink-muted">{meta.meaning}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-caption text-ink-muted">
          Colour never travels alone here: the word is always written beside it, so a new member of staff can
          follow the system on their first shift.
        </p>
      </section>

      {ordered.length > 0 && (
        <section className="mt-10">
          <h2 className="text-h3">What this setting buys</h2>
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {ordered.map((c) => (
              <li key={c.slug}>
                <Link href={`/products/${c.slug}`} className="block h-full border border-line bg-surface p-5 hover:border-accent">
                  <h3 className="text-body font-medium text-ink">{c.name}</h3>
                  {c.description ? <p className="mt-1 text-body text-ink-muted">{c.description}</p> : null}
                  <p className="mt-2 text-caption text-ink-muted">
                    {c._count.products} {c._count.products === 1 ? "product" : "products"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-h3">What buyers in {industry.name.toLowerCase()} ask</h2>
        <dl className="mt-4 max-w-reading space-y-5">
          {industry.faq.map((f) => (
            <div key={f.q}>
              <dt className="text-body font-medium text-ink">{f.q}</dt>
              <dd className="mt-1 text-body text-ink-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10 border border-line bg-surface p-5">
        <h2 className="text-h3">Talk to someone who knows the setting</h2>
        <p className="mt-2 max-w-reading text-body text-ink-muted">
          Send us your site list and what you clean today. We will come back with a product list, the dilutions,
          and a price — not a brochure.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href={`/quote?context=${industry.slug}`} variant="primary">
            Request a quote
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Contact us
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
