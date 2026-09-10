import type { Metadata } from "next";
import Link from "next/link";
import { db, Prisma } from "@safuney/db";
import { services } from "@/lib/env";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/seo/jsonld";
import { Crumbs } from "@/components/marketing/crumbs";
import { CtaBand } from "@/components/marketing/cta-band";
import { Icon, type IconName } from "@/components/marketing/icons";

export const metadata: Metadata = {
  title: "Resources",
  description: "Colour-coding guide, dilution charts and safety data sheets for professional cleaning and hygiene in Kenya.",
  // No hreflang: there is no Swahili edition of this page yet (only /sw exists).
  alternates: { canonical: "/resources" },
};

export const revalidate = 3600;

export default async function ResourcesPage() {
  const [sdsCount, dilutionCount]: [number, number] = services.database()
    ? await Promise.all([
        db().document.count({ where: { type: "SDS", supersededBy: null } }),
        // Prisma's Json filter cannot express "not null" directly; DbNull is the SQL NULL this column uses.
        db().product.count({ where: { isActive: true, needsPoReview: false, OR: [{ dilutionGuidance: { not: Prisma.DbNull } }, { dilutionText: { not: null } }] } }),
      ]).catch((): [number, number] => [0, 0])
    : [0, 0];

  const cards: Array<{ href: string; title: string; blurb: string; meta: string; icon: IconName }> = [
    { href: "/resources/colour-coding", title: "Colour-coding guide", blurb: "The four zones and how to run them.", meta: "4 zones", icon: "sparkles" },
    {
      href: "/resources/dilution",
      title: "Dilution calculator",
      blurb: "How much to measure, and what each pack makes.",
      // A count only when the database has one to give; the calculator itself always works.
      meta: dilutionCount > 0 ? `${dilutionCount} ${dilutionCount === 1 ? "product" : "products"}` : "Calculator",
      icon: "calculator",
    },
    { href: "/resources/safety-data-sheets", title: "Safety data sheets", blurb: "The current sheet for your site file.", meta: sdsCount > 0 ? `${sdsCount} ${sdsCount === 1 ? "sheet" : "sheets"}` : "On request", icon: "clipboard" },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Resources", path: "/resources" }])) }} />
      <section aria-labelledby="resources-heading" className="on-dark bg-hero">
        <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-14">
          <Crumbs items={[{ label: "Guides and safety data" }]} />
          <h1 id="resources-heading" className="mt-4 text-h1 text-white">
            Guides and safety data
          </h1>
          <p className="mt-2 text-body-lg text-white/75">Zone guide, dilution calculator and safety data sheets.</p>
        </div>
      </section>

      <div className="mx-auto max-w-page px-5 py-12 md:px-6 md:py-16">
        <ul className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="group flex h-full flex-col rounded-card border border-line bg-surface p-6 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-stainless hover:shadow-lift motion-reduce:transform-none"
              >
                <span className="grid size-12 place-items-center rounded-xl bg-accent-wash text-accent">
                  <Icon name={c.icon} />
                </span>
                <h2 className="mt-5 text-h3 text-ink">{c.title}</h2>
                <p className="mt-1 text-body text-ink-muted">{c.blurb}</p>
                <span className="mt-auto flex items-center justify-between pt-5 text-small font-medium text-accent">
                  {c.meta}
                  <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <CtaBand id="resources-cta" title="Need a sheet or a dilution checked?" body="Ask us. We reply in one working day." whatsappText="Hello Safuney, I need a safety data sheet for:" />
    </>
  );
}
