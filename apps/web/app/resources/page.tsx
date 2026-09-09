import type { Metadata } from "next";
import Link from "next/link";
import { db, Prisma } from "@safuney/db";
import { services } from "@/lib/env";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Resources",
  description: "Colour-coding guide, dilution charts and safety data sheets for professional cleaning and hygiene in Kenya.",
  alternates: { canonical: "/resources", languages: { en: "/resources", sw: "/sw/resources" } },
};

export const revalidate = 3600;

export default async function ResourcesPage() {
  const [sdsCount, dilutionCount] = services.database()
    ? await Promise.all([
        db().document.count({ where: { type: "SDS", supersededBy: null } }),
        // Prisma's Json filter cannot express "not null" directly; DbNull is the SQL NULL this column uses.
        db().product.count({ where: { isActive: true, needsPoReview: false, OR: [{ dilutionGuidance: { not: Prisma.DbNull } }, { dilutionText: { not: null } }] } }),
      ])
    : [0, 0];

  const cards = [
    {
      href: "/resources/colour-coding",
      title: "Colour-coding guide",
      blurb: "The four zones, what each covers, and how to run the system so it survives new staff.",
      meta: "4 zones",
    },
    {
      href: "/resources/dilution",
      title: "Dilution charts",
      blurb: "What each concentrate makes, per pack, with the contact time the figure assumes.",
      meta: dilutionCount > 0 ? `${dilutionCount} ${dilutionCount === 1 ? "product" : "products"}` : "Being reviewed",
    },
    {
      href: "/resources/safety-data-sheets",
      title: "Safety data sheets",
      blurb: "The current SDS for every product, with its version history, for your site file.",
      meta: sdsCount > 0 ? `${sdsCount} ${sdsCount === 1 ? "sheet" : "sheets"}` : "Ask us",
    },
  ];

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Resources", path: "/resources" }])) }} />
      <h1 className="text-h1">Resources</h1>
      <p className="mt-3 max-w-reading text-body-lg text-ink-muted">
        What your team needs on the wall and in the file: the zoning system, what a concentrate actually makes,
        and the safety data sheet an auditor will ask for.
      </p>
      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="block h-full border border-line bg-surface p-5 hover:border-accent">
              <h2 className="text-h3 text-ink">{c.title}</h2>
              <p className="mt-2 text-body text-ink-muted">{c.blurb}</p>
              <p className="mt-3 text-caption text-ink-muted">{c.meta}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
