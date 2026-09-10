import type { Metadata } from "next";
import Link from "next/link";
import { ZoneBadge } from "@safuney/ui";
import { INDUSTRIES } from "@/lib/content/solutions";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/seo/jsonld";
import { Crumbs } from "@/components/marketing/crumbs";
import { CtaBand } from "@/components/marketing/cta-band";
import { Icon } from "@/components/marketing/icons";
import { INDUSTRY_ICON } from "@/components/marketing/industry-icons";

export const metadata: Metadata = {
  title: "Solutions by industry",
  description: "Cleaning and hygiene programmes for hospitality, healthcare, foodservice, education, food and beverage processing, industrial sites and facilities management in Kenya.",
  alternates: { canonical: "/solutions", languages: { en: "/solutions", sw: "/sw/solutions" } },
};

export default function SolutionsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Solutions", path: "/solutions" }])) }} />
      <section aria-labelledby="solutions-heading" className="on-dark bg-hero">
        <div className="mx-auto max-w-page px-5 py-12 md:px-6 md:py-16">
          <Crumbs items={[{ label: "Solutions" }]} />
          <h1 id="solutions-heading" className="mt-4 text-hero text-white">
            Solutions by industry
          </h1>
          <p className="mt-5 max-w-[56ch] text-body-lg text-white/75">
            The zones you clean and the products that cover them.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-page px-5 py-12 md:px-6 md:py-16">
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((i) => (
            <li key={i.slug}>
              <Link
                href={`/solutions/${i.slug}`}
                className="group flex h-full flex-col rounded-card border border-line bg-surface p-6 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-stainless hover:shadow-lift motion-reduce:transform-none"
              >
                <span className="grid size-12 place-items-center rounded-xl bg-accent-wash text-accent">
                  <Icon name={INDUSTRY_ICON[i.slug] ?? "building"} />
                </span>
                <h2 className="mt-5 text-h3 text-ink">{i.name}</h2>
                <p className="mt-2 text-body text-ink-muted">{i.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {i.zones.map((z) => (
                    <ZoneBadge key={z} zone={z} />
                  ))}
                </div>
                <span className="mt-auto inline-flex items-center gap-1 pt-5 text-small font-medium text-accent">
                  See the programme
                  <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <CtaBand id="solutions-cta" />
    </>
  );
}
