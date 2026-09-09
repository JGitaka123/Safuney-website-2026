import type { Metadata } from "next";
import Link from "next/link";
import { ZoneBadge } from "@safuney/ui";
import { INDUSTRIES } from "@/lib/content/solutions";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Solutions by industry",
  description: "Cleaning and hygiene programmes for hospitality, healthcare, foodservice, education, industrial sites and facilities management in Kenya.",
  alternates: { canonical: "/solutions", languages: { en: "/solutions", sw: "/sw/solutions" } },
};

export default function SolutionsPage() {
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Solutions", path: "/solutions" }])) }} />
      <h1 className="text-h1">Solutions by industry</h1>
      <p className="mt-3 max-w-reading text-body-lg text-ink-muted">
        The same chemistry, arranged the way each trade actually buys it — which zones you clean, which
        products cover them, and the questions your team asks before it orders.
      </p>
      <ul className="mt-8 grid gap-5 md:grid-cols-2">
        {INDUSTRIES.map((i) => (
          <li key={i.slug}>
            <Link href={`/solutions/${i.slug}`} className="block h-full border border-line bg-surface p-5 hover:border-accent">
              <h2 className="text-h3 text-ink">{i.name}</h2>
              <p className="mt-2 text-body text-ink-muted">{i.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {i.zones.map((z) => (
                  <ZoneBadge key={z} zone={z} />
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
