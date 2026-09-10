import type { Metadata } from "next";
import Link from "next/link";
import { db, Prisma } from "@safuney/db";
import { DilutionTable, ZoneBadge, type DilutionRow, type ZoneKey } from "@safuney/ui";
import { services } from "@/lib/env";
import { litresPerPack, parseGuidance } from "@/lib/catalogue/dilution";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Dilution charts",
  description: "What each Safuney concentrate makes per pack, at what ratio, with the contact time the figure assumes.",
  // No hreflang: there is no Swahili edition of this page yet (only /sw exists).
  alternates: { canonical: "/resources/dilution" },
};

export const revalidate = 3600;

/** Pack size in litres; a pack sold by the piece makes no solution and is left out of the yield column. */
function litresOf(v: { packSizeValue: unknown; unit: string }): number {
  const n = Number(v.packSizeValue);
  if (!Number.isFinite(n)) return 0;
  return v.unit === "ML" || v.unit === "G" ? n / 1000 : v.unit === "PCS" ? 0 : n;
}

export default async function DilutionPage() {
  const products = services.database()
    ? await db().product.findMany({
        where: { isActive: true, needsPoReview: false, OR: [{ dilutionGuidance: { not: Prisma.DbNull } }, { dilutionText: { not: null } }] },
        select: {
          slug: true,
          name: true,
          zone: true,
          dilutionGuidance: true,
          dilutionText: true,
          category: { select: { slug: true } },
          variants: { where: { isActive: true }, select: { packLabel: true, packSizeValue: true, unit: true }, orderBy: { sortOrder: "asc" } },
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Resources", path: "/resources" }, { name: "Dilution charts", path: "/resources/dilution" }])) }} />
      <nav aria-label="Breadcrumb" className="text-caption text-ink-muted">
        <Link href="/resources" className="underline hover:text-ink">
          Resources
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">Dilution charts</span>
      </nav>

      <h1 className="mt-3 text-h1">Dilution charts</h1>
      <p className="mt-3 max-w-reading text-body-lg text-ink-muted">
        Every concentrate we sell, at what ratio, for what job, and how much solution a pack actually makes.
      </p>
      <p className="mt-4 max-w-reading text-body text-ink">
        The yield figures assume the concentrate is measured, not poured. A 5 L pack at 1:40 makes 205 L of
        solution when it is dosed and closer to 80 L when it is not — which is usually the whole difference
        between a cleaning budget that holds and one that does not.
      </p>

      {products.length === 0 ? (
        <p className="mt-8 border border-line bg-surface p-5 text-body text-ink">
          The dilution guidance for our range is being reviewed before it goes on the site. We would rather show
          you nothing than a ratio that is wrong.{" "}
          <Link href="/contact" className="text-accent underline">
            Ask us for the chart
          </Link>{" "}
          and we will send the current one.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {products.map((p) => {
            const rows = parseGuidance(p.dilutionGuidance);
            const zone = p.zone === "NONE" ? null : (p.zone as ZoneKey);
            const tableRows: DilutionRow[] = rows.map((r) => ({
              ratio: `1:${r.ratio}`,
              use: r.use,
              contactTime: r.contactTimeMinutes ? `${r.contactTimeMinutes} min` : "—",
              ...(r.note ? { note: r.note } : {}),
            }));
            const strongest = rows.length > 0 ? Math.max(...rows.map((r) => r.ratio)) : 0;
            return (
              <section key={p.slug}>
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="text-h3">
                    <Link href={`/products/${p.category.slug}/${p.slug}`} className="text-accent underline">
                      {p.name}
                    </Link>
                  </h2>
                  {zone ? <ZoneBadge zone={zone} /> : null}
                </div>

                {tableRows.length > 0 ? (
                  <DilutionTable className="mt-3" rows={tableRows} caption={`Dilution ratios and contact times for ${p.name}`} />
                ) : p.dilutionText ? (
                  <p className="mt-3 max-w-reading text-body text-ink">{p.dilutionText}</p>
                ) : null}

                {strongest > 0 && p.variants.length > 0 ? (
                  <p className="mt-3 text-caption text-ink-muted">
                    At its weakest listed ratio (1:{strongest}), one pack makes:{" "}
                    {p.variants
                      .filter((v) => litresOf(v) > 0)
                      .map((v) => `${v.packLabel} → ${litresPerPack(litresOf(v), strongest)} L`)
                      .join(" · ")}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
