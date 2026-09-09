import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@safuney/db";
import { Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import { services } from "@/lib/env";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Safety data sheets",
  description: "The current safety data sheet for every Safuney product, with its version history, for your site file.",
  alternates: { canonical: "/resources/safety-data-sheets", languages: { en: "/resources/safety-data-sheets", sw: "/sw/resources/safety-data-sheets" } },
};

export const revalidate = 3600;

export default async function SdsPage() {
  // Only the current version of each sheet: a superseded SDS in a site file is worse than none, because
  // it looks like a record and is not one.
  const documents = services.database()
    ? await db().document.findMany({
        where: { type: "SDS", supersededBy: null },
        select: { id: true, title: true, version: true, fileUrl: true, publishedAt: true, sizeBytes: true, sdsFor: { select: { name: true, slug: true, category: { select: { slug: true } } } } },
        orderBy: { title: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Resources", path: "/resources" }, { name: "Safety data sheets", path: "/resources/safety-data-sheets" }])) }} />
      <nav aria-label="Breadcrumb" className="text-caption text-ink-muted">
        <Link href="/resources" className="underline hover:text-ink">
          Resources
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">Safety data sheets</span>
      </nav>

      <h1 className="mt-3 text-h1">Safety data sheets</h1>
      <p className="mt-3 max-w-reading text-body-lg text-ink-muted">
        The current sheet for every product we supply. Keep a printed copy where the chemicals are stored, not
        only in a folder in an office.
      </p>
      <p className="mt-4 max-w-reading text-body text-ink">
        Two things that matter more than the paperwork: never store chlorine-based products next to an acidic
        descaler, and never decant a concentrate into an unlabelled bottle. Most incidents we hear about are one
        of those two.
      </p>

      {documents.length === 0 ? (
        <div className="mt-8 max-w-reading border border-line bg-surface p-5">
          <p className="text-body text-ink">
            We have not published our safety data sheets on the site yet. We are not going to put up a sheet we
            have not checked against the product in the drum.
          </p>
          <p className="mt-3 text-body text-ink">
            Ask us for the sheets you need and we will send the current versions the same working day.
          </p>
          <p className="mt-4 text-body">
            <Link href="/contact" className="text-accent underline">
              Request safety data sheets
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <Table caption="Current safety data sheets">
            <THead>
              <Tr>
                <Th>Sheet</Th>
                <Th>Product</Th>
                <Th>Version</Th>
                <Th>Published</Th>
              </Tr>
            </THead>
            <TBody>
              {documents.map((d) => (
                <Tr key={d.id}>
                  <Td>
                    <a href={d.fileUrl} className="text-accent underline" target="_blank" rel="noopener noreferrer">
                      {d.title}
                    </a>
                    {d.sizeBytes ? <span className="mt-1 block text-caption text-ink-muted">PDF, {Math.round(d.sizeBytes / 1024)} KB</span> : null}
                  </Td>
                  <Td>
                    {d.sdsFor.length === 0
                      ? "—"
                      : d.sdsFor.map((p) => (
                          <Link key={p.slug} href={`/products/${p.category.slug}/${p.slug}`} className="block text-accent underline">
                            {p.name}
                          </Link>
                        ))}
                  </Td>
                  <Td className="tabular-nums">{d.version}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{d.publishedAt.toISOString().slice(0, 10)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
