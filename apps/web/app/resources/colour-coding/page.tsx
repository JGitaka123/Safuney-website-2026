import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@safuney/db";
import { ZONES, ZoneBand, ZoneBadge } from "@safuney/ui";
import { services } from "@/lib/env";
import { breadcrumbJsonLd, faqJsonLd, jsonLdString } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Colour-coding guide",
  description: "The four cleaning zones — washrooms, general areas, kitchen and food prep, clinical and isolation — what each covers, and how to run the system.",
  // No hreflang: there is no Swahili edition of this page yet (only /sw exists).
  alternates: { canonical: "/resources/colour-coding" },
};

export const revalidate = 3600;

const FAQ = [
  { q: "Why colour-code at all?", a: "So a cloth that cleaned a toilet never reaches a food-preparation surface. Cross-contamination is the failure that colour coding exists to prevent, and it is invisible until someone is ill." },
  { q: "What has to be colour-coded?", a: "Cloths, mops, buckets and gloves — everything that touches a surface and then touches another one. Chemicals do not have to match the colour, but products sold for a zone are marked with it here so nobody has to remember." },
  { q: "Four colours or more?", a: "Four covers almost every site in Kenya. More colours mean more to remember and more to get wrong; if a site genuinely needs a fifth, add it deliberately and train on it." },
  { q: "What if staff cannot read the labels?", a: "That is the argument for colour, not against it — but the word must be there too. Every zone marking on this site carries its label, because colour alone excludes anyone who cannot distinguish them." },
];

export default async function ColourCodingPage() {
  const counts = services.database()
    ? await db().product.groupBy({ by: ["zone"], where: { isActive: true, needsPoReview: false }, _count: { _all: true } })
    : [];
  const countFor = (key: string) => counts.find((c) => c.zone === key)?._count._all ?? 0;

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Resources", path: "/resources" }, { name: "Colour-coding guide", path: "/resources/colour-coding" }]),
            faqJsonLd(FAQ),
          ]),
        }}
      />
      <nav aria-label="Breadcrumb" className="text-caption text-ink-muted">
        <Link href="/resources" className="underline hover:text-ink">
          Resources
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">Colour-coding guide</span>
      </nav>

      <h1 className="mt-3 text-h1">Colour-coding guide</h1>
      <p className="mt-3 max-w-reading text-body-lg text-ink-muted">
        Four zones, four colours, and the word written beside every one of them. Print this, put it where the
        cleaning store is, and train on it once.
      </p>

      <ul className="mt-8 space-y-5">
        {ZONES.map((z) => (
          <li key={z.key} className="border border-line bg-surface">
            <ZoneBand zones={[z.key]} />
            <div className="p-5">
              <ZoneBadge zone={z.key} />
              <p className="mt-3 text-body text-ink">{z.meaning}</p>
              <p className="mt-3 text-caption text-ink-muted">
                {countFor(z.key) > 0 ? (
                  <Link href={`/products?zone=${z.slug}`} className="text-accent underline">
                    {countFor(z.key)} {countFor(z.key) === 1 ? "product" : "products"} for this zone
                  </Link>
                ) : (
                  "Products for this zone are being reviewed before they go on sale."
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-10 max-w-reading">
        <h2 className="text-h3">Making it stick</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-body text-ink">
          <li>Store each zone&rsquo;s equipment separately. A shared shelf undoes the whole system by the end of the week.</li>
          <li>Buy the equipment in the colours. Coloured tape on a grey bucket lasts about a month.</li>
          <li>Put the chart on the store-room wall, not in a folder.</li>
          <li>Train once properly, then check. The failure is never the chart; it is a busy shift and one cloth.</li>
        </ol>
      </section>

      <section className="mt-10 max-w-reading">
        <h2 className="text-h3">Questions we get</h2>
        <dl className="mt-4 space-y-5">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="text-body font-medium text-ink">{f.q}</dt>
              <dd className="mt-1 text-body text-ink-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
