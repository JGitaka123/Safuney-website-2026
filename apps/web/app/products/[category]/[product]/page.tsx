import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DilutionTable, HazardBadge, HazardPictogram, hazardLabel, ZoneBadge, zoneMeta, type HazardClass, type ZoneKey } from "@safuney/ui";
import { money } from "@safuney/db";
import { site } from "@/config/site";
import { parseGuidance, ratioLabel } from "@/lib/catalogue/dilution";
import { parseFilters } from "@/lib/catalogue/filters";
import { getCategoryPage, getProduct, listVisibleProductPaths, stockStatus } from "@/lib/catalogue/queries";
import { quoteHref, telHref, whatsappHref } from "@/lib/contact";
import { INDUSTRIES } from "@/lib/content/solutions";
import { displayPrice } from "@/lib/pricing";
import { getPriceDisplayMode, isFeatureEnabled } from "@/lib/settings";
import { breadcrumbJsonLd, faqJsonLd, jsonLdString, productJsonLd } from "@/lib/seo/jsonld";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { DilutionCalculator } from "@/components/catalogue/dilution-calculator";
import { ProductGridCard, sizesLine } from "@/components/catalogue/product-grid-card";
import { PurchasePanel, type PurchaseVariant } from "@/components/catalogue/purchase-panel";
import { AvailabilityNote } from "@/components/catalogue/availability-note";
import { btn } from "@/components/marketing/buttons";
import { Icon, type IconName } from "@/components/marketing/icons";
import { rangeMeta } from "@/components/marketing/range-meta";

type Params = Promise<{ category: string; product: string }>;

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    return await listVisibleProductPaths();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category, product: slug } = await params;
  const product = await getProduct(category, slug);
  if (!product) return { title: "Product" };
  /*
   * SKU and category in the title, after the product name.
   *
   * Trade buyers search by code — they have a delivery note or a last order in front of them, not a
   * product name — and the deep-catalogue suppliers all put the code and the breadcrumb chain in the
   * title tag for exactly that reason. The PO's own `seoTitle` still wins when they have written one.
   */
  // Only a real product code goes in — short, like a code. The harvested placeholder SKUs are the
  // full product name in capitals, and putting one here pushes the title past what a search result
  // shows. When the PO imports their own codes this fills itself in.
  const code = product.variants.map((v) => v.sku).find((sku) => sku && sku.length <= 16);
  const derived = [product.name, code, product.category.name].filter(Boolean).join(" | ");
  return {
    title: product.seoTitle ?? derived,
    description: product.seoDescription ?? product.shortDescription,
    alternates: { canonical: `/products/${category}/${slug}` },
    // No `images` here on purpose: setting it would override the generated share card in
    // opengraph-image.tsx with the bare 480 px cut-out, which platforms either reject as too small or
    // composite onto a background of their own choosing. The card carries the same photograph at the
    // 1200 x 630 they ask for.
    openGraph: {
      title: product.name,
      description: product.shortDescription,
    },
  };
}

function litresOf(v: { packSizeValue: unknown; unit: string }): number {
  const n = Number(v.packSizeValue);
  if (!Number.isFinite(n)) return 0;
  return v.unit === "ML" || v.unit === "G" ? n / 1000 : v.unit === "PCS" ? 0 : n;
}

/** "5 L", "5 L and 20 L", "5 kg, 20 kg and 25 kg". */
function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function PanelHeading({ id, icon, children }: { id?: string; icon?: IconName; children: ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-eyebrow uppercase text-accent">
      {icon ? <Icon name={icon} className="size-4" /> : <span aria-hidden className="size-2.5 rounded-[3px] bg-accent" />}
      {children}
    </h2>
  );
}

/*
 * The product page, laid out on Alliance Chemical's: gallery, name and sizes, and a sticky buy box
 * across the top; then related ranges, quick facts, a quick answer, technical documents, who uses it,
 * and delivery — every block built from the catalogue's own data, never from invented copy.
 */
export default async function ProductPage({ params }: { params: Params }) {
  const { category, product: slug } = await params;
  const [product, mode, shopEnabled] = await Promise.all([getProduct(category, slug), getPriceDisplayMode(), isFeatureEnabled("shop.enabled")]);
  if (!product) notFound();

  const path = `/products/${category}/${slug}`;
  const vatRateBps = product.variants[0]?.vatRateBps ?? 1600;
  const variants: PurchaseVariant[] = product.variants.map((v) => {
    const price = displayPrice(v.priceMinorUnits, v.vatRateBps, mode);
    const stock = stockStatus(v);
    return {
      id: v.id,
      sku: v.sku,
      label: v.packLabel,
      packSizeValue: String(v.packSizeValue),
      unit: v.unit,
      priceHeadline: v.priceMinorUnits > 0n ? price.headline : "Price on request",
      vatLine: v.priceMinorUnits > 0n ? price.vatLine : "",
      exVatMinor: price.exVatMinor,
      poa: v.priceMinorUnits <= 0n,
      stock,
      available: v.stockOnHand - v.stockReserved,
      madeToOrder: v.isMadeToOrder,
      weightGrams: v.weightGrams,
    };
  });
  const dilution = parseGuidance(product.dilutionGuidance);
  const faq = Array.isArray(product.faq) ? (product.faq as Array<{ q: string; a: string }>).filter((f) => f && typeof f.q === "string" && typeof f.a === "string") : [];
  const related = product.relatedFrom;
  const boughtTogether = related.filter((r) => r.kind === "FREQUENTLY_BOUGHT_TOGETHER").map((r) => r.to);
  const dispensers = related.filter((r) => r.kind === "COMPATIBLE_DISPENSER").map((r) => r.to);
  const alternatives = related.filter((r) => r.kind === "ALTERNATIVE").map((r) => r.to);
  const documents = [
    ...(product.sdsDocument ? [{ ...product.sdsDocument, type: "SDS" as const }] : []),
    ...(product.coaDocument ? [{ ...product.coaDocument, type: "COA" as const }] : []),
    ...product.documents.map((d) => d.document).filter((d) => d.id !== product.sdsDocument?.id && d.id !== product.coaDocument?.id),
  ];
  const zone = product.zone === "NONE" ? null : (product.zone as ZoneKey);
  const zoneInfo = zoneMeta(product.zone);
  const image = product.images[0];
  const meta = rangeMeta(category);
  const sizes = product.variants.map((v) => v.packLabel).filter((l) => /\d/.test(l));
  const firstSku = product.variants[0]?.sku ?? "";
  const dilutionSummary = dilution.length ? dilution.map((r) => `${ratioLabel(r.ratio)} for ${r.use.toLowerCase()}`).join("; ") : product.dilutionText;
  const usedBy = INDUSTRIES.filter((i) => i.categories.includes(category));
  const relatedRanges = site.productAreas.filter((a) => a.slug !== category && zone !== null && (a.zones as readonly string[]).includes(zone)).slice(0, 3);
  const hazardName = product.hazardClass === "NONE" ? "No hazard class" : hazardLabel[product.hazardClass as HazardClass];

  // The rest of the range, for the buyer who landed here and wants the thing next to it.
  const rangePage = await getCategoryPage(category, parseFilters({}));
  const moreFromRange = (rangePage?.products ?? []).filter((p) => p.slug !== product.slug);

  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Products", path: "/products" },
      { name: product.category.name, path: `/products/${category}` },
      { name: product.name, path },
    ]),
    productJsonLd({
      name: product.name,
      description: product.shortDescription,
      path,
      brand: product.brand,
      images: product.images.map((i) => i.url),
      sku: product.variants[0]?.sku ?? product.slug,
      offers: product.variants
        .filter((v) => v.priceMinorUnits > 0n)
        .map((v) => {
          const s = stockStatus(v);
          const inc = mode === "INC_VAT" ? v.priceMinorUnits + money.vatOn(v.priceMinorUnits, v.vatRateBps) : v.priceMinorUnits;
          return { sku: v.sku, name: `${product.name} ${v.packLabel}`, url: `${path}?sku=${v.sku}`, priceKes: money.formatKes(inc, { symbol: false }).replace(/,/g, ""), availability: s.key === "out" ? ("OutOfStock" as const) : s.key === "mto" ? ("BackOrder" as const) : ("InStock" as const) };
        }),
      rating: product.ratingSummary,
    }),
    ...(faq.length ? [faqJsonLd(faq)] : []),
  ];

  return (
    <div className="mx-auto max-w-page px-5 py-6 md:px-6 md:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <Breadcrumbs items={[{ href: "/products", label: "Products" }, { href: `/products/${category}`, label: product.category.name }, { label: product.name }]} />

      {/* Gallery, name and sizes, buy box */}
      <div className="mt-4 rounded-[20px] border border-line bg-surface p-4 shadow-card md:p-6">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-4">
            <figure className="relative overflow-hidden rounded-card border border-line bg-surface">
              <div className="grid aspect-square place-items-center overflow-hidden p-8">
                {image ? (
                  // Never scaled past the file's own pixels. The pack shots are resampled once, at
                  // extraction (ADR 0016); letting the browser stretch them again on top of that is
                  // what turns a real photograph into a blurred one.
                  <Image
                    src={image.url}
                    alt={image.alt}
                    width={image.width ?? 480}
                    height={image.height ?? 480}
                    priority
                    className="object-contain"
                    style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
                    sizes="(min-width: 1024px) 460px, 100vw"
                  />
                ) : (
                  <div aria-hidden className="grid h-full w-full place-items-center bg-ground-deep p-8">
                    <span className="text-center text-h2 text-ink">{product.name}</span>
                  </div>
                )}
              </div>
              {zone ? <div className={`absolute inset-x-0 bottom-0 h-1.5 ${zone === "RED" ? "bg-zone-red" : zone === "BLUE" ? "bg-zone-blue" : zone === "GREEN" ? "bg-zone-green" : "bg-zone-yellow"}`} /> : null}
            </figure>
            {product.images.length > 1 ? (
              <ul className="mt-3 grid grid-cols-5 gap-2">
                {product.images.slice(0, 5).map((img) => (
                  <li key={img.url} className="overflow-hidden rounded-chip border border-line bg-surface">
                    <Image src={img.url} alt={img.alt} width={200} height={200} className="aspect-square w-full object-contain" />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:col-span-4">
            <p className="text-small">
              <Link href={`/products/${category}`} className={`font-semibold hover:underline underline-offset-[3px] ${meta.text}`}>
                {product.category.name}
              </Link>
              {product.brand ? <span className="text-ink-muted"> · {product.brand}</span> : null}
            </p>
            <h1 className="-mt-2 text-h1">{product.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {zone ? <ZoneBadge zone={zone} /> : null}
              {product.hazardClass !== "NONE" ? <HazardBadge hazard={product.hazardClass as HazardClass} /> : null}
            </div>
            <p className="text-body text-ink-muted">{product.shortDescription}</p>

            <div>
              <p className="text-label uppercase tracking-wide text-ink-muted">Available sizes</p>
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {sizes.map((s) => (
                  <li key={s} className="grid min-h-14 place-items-center rounded-chip border border-line bg-ground px-2 text-center text-small font-medium text-ink">
                    {s}
                  </li>
                ))}
                <li>
                  <Link
                    href={quoteHref({ product: product.name })}
                    className="flex min-h-14 flex-col items-center justify-center rounded-chip border border-dashed border-stainless px-2 text-center text-small font-semibold leading-tight text-ink hover:border-accent hover:text-accent"
                  >
                    Bulk
                    <span className="text-caption font-normal text-ink-muted">Get a quote</span>
                  </Link>
                </li>
              </ul>
            </div>

            {moreFromRange.length > 0 ? (
              <div className="rounded-card border border-line bg-ground p-4">
                <p className="text-small font-semibold text-ink">Need a different product?</p>
                <ul className="mt-3 flex flex-col gap-2">
                  <li className="flex items-center justify-between gap-3 rounded-chip bg-accent px-3 py-2 text-small font-medium text-white">
                    <span className="truncate">{product.name}</span>
                    <span className="shrink-0 rounded bg-white/20 px-1.5 py-0.5 text-caption">Current</span>
                  </li>
                  {moreFromRange.slice(0, 4).map((p) => (
                    <li key={p.id}>
                      <Link href={`/products/${category}/${p.slug}`} className="flex items-center justify-between gap-3 rounded-chip border border-line bg-surface px-3 py-2 text-small text-ink hover:border-accent hover:text-accent">
                        <span className="truncate">{p.name}</span>
                        <span className="shrink-0 text-caption text-ink-muted">{p.variants.filter((v) => /\d/.test(v.packLabel)).map((v) => v.packLabel).join(" · ") || "On request"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 lg:col-span-4">
            <div className="flex flex-col gap-4 rounded-card border border-line border-t-4 border-t-accent bg-surface p-5 lg:sticky lg:top-36">
              <p className="text-label uppercase tracking-wide text-ink-muted">Your selection</p>
              <PurchasePanel productName={product.name} variants={variants} mode={mode} vatRateBps={vatRateBps} shopEnabled={shopEnabled} />
              {/* Server-rendered from live stock: the first pack is the one selected on arrival. */}
              {variants[0] && !product.fromSnapshot ? <AvailabilityNote variantId={variants[0].id} /> : null}
              <div className="rounded-chip bg-cta/15 p-4 text-small">
                <p className="flex items-center gap-2 font-semibold text-brand-green-ink">
                  <Icon name="check" className="size-4" />
                  Priced within one working day
                </p>
                <p className="mt-1 text-ink-muted">eTIMS-compliant invoice. Delivery across Kenya, quoted before you pay.</p>
              </div>
              <a
                href={whatsappHref(`Hello Safuney, I have a question about ${product.name}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-small font-medium text-ink underline underline-offset-[3px] hover:text-accent"
              >
                <Icon name="whatsapp" className="size-4 text-[#128c4a]" />
                Ask a question
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Related ranges */}
      <div className="mt-6 rounded-card border border-line border-l-4 border-l-accent bg-surface p-5 md:p-6">
        <p className="text-label uppercase tracking-wide text-ink">Explore related ranges</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {[{ slug: category, name: product.category.name }, ...relatedRanges.map((a) => ({ slug: a.slug, name: a.name }))].map((r) => (
            <li key={r.slug}>
              <Link href={`/products/${r.slug}`} className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-small font-semibold text-accent hover:border-accent hover:bg-accent-wash">
                {r.name}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-dashed border-line pt-4 text-small text-ink-muted">
          <li>
            <Link href="/resources/safety-data-sheets" className="hover:text-ink hover:underline">
              Safety data sheets
            </Link>
          </li>
          <li>
            <Link href={quoteHref({ product: product.name })} className="hover:text-ink hover:underline">
              Request a quote
            </Link>
          </li>
          <li>
            <Link href="/products" className="hover:text-ink hover:underline">
              Browse all products
            </Link>
          </li>
        </ul>
      </div>

      {/* Quick facts */}
      <section aria-labelledby="facts" className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 md:p-6">
          <PanelHeading id="facts">Product quick facts</PanelHeading>
          <ul className="flex flex-wrap gap-2">
            {product.variants.slice(0, 3).map((v) => (
              <li key={v.sku} className="rounded-chip border border-line bg-ground px-2 py-1 font-mono text-mono-sm text-ink">
                {v.sku}
              </li>
            ))}
          </ul>
        </div>
        <p className="px-5 pb-5 text-body text-ink md:px-6">
          <strong>{product.name}</strong>: {product.shortDescription} {sizes.length ? `Supplied in ${listJoin(sizes)}.` : "Pack size on request."}
          {dilution[0] ? ` Used at ${ratioLabel(dilution[0].ratio).toLowerCase()} for ${dilution[0].use.toLowerCase()}.` : ""}
        </p>
        <dl className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Pack sizes", value: sizes.length ? sizes.join(", ") : "On request" },
            { label: "Dilution", value: dilution[0] ? `${ratioLabel(dilution[0].ratio)}, ${dilution[0].use.toLowerCase()}` : product.dilutionText ? "See the dilution notes" : "Ask us for your job" },
            { label: "Where it is used", value: zoneInfo?.label ?? product.category.name },
            { label: "Delivery", value: "Across Kenya, quoted before you pay" },
          ].map((f) => (
            <div key={f.label} className="bg-ground p-5">
              <dt className="text-label uppercase tracking-wide text-ink-muted">{f.label}</dt>
              <dd className="mt-1 text-small text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-3 border-t border-line p-5 md:px-6">
          <Link href={quoteHref({ product: product.name })} className={`${btn.brand} ${btn.sm} rounded-full`}>
            Request bulk quote
            <Icon name="arrowRight" className="size-4" />
          </Link>
          <a href={telHref} className={`${btn.secondary} ${btn.sm} rounded-full`}>
            {site.contact.phone.display}
          </a>
        </div>
      </section>

      {/* Quick answer */}
      <section aria-labelledby="quick-answer" className="mt-4 rounded-card border border-line bg-surface p-5 md:p-6">
        <PanelHeading>Quick answer</PanelHeading>
        <h2 id="quick-answer" className="mt-2 text-h3 text-ink">
          What is {product.name} used for, and what should buyers check before ordering?
        </h2>
        <p className="mt-2 text-body text-ink-muted">
          <strong className="text-ink">{product.name}</strong>: {product.shortDescription} Confirm the pack size, the dilution for each job, and whether you need the safety data sheet on file.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: "Range", v: product.category.name },
            { k: "Zone", v: zoneInfo?.label ?? "Any area" },
            { k: "Hazard", v: hazardName },
            { k: "Packs", v: sizes.length ? sizes.join(", ") : "On request" },
          ].map((p) => (
            <li key={p.k} className="rounded-chip border border-line px-3 py-2 text-small text-ink">
              <span className="font-semibold">{p.k}:</span> {p.v}
            </li>
          ))}
        </ul>
      </section>

      {/* Technical documents */}
      <section aria-labelledby="docs" className="mt-4 rounded-card border border-line bg-ground p-5 md:p-6">
        <PanelHeading id="docs">Technical documents</PanelHeading>
        <ul className="mt-3 flex flex-wrap gap-2">
          {documents.length > 0 ? (
            documents.map((d) => (
              <li key={d.id}>
                <a href={d.fileUrl} download className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink hover:border-accent">
                  {d.type === "SDS" ? "SDS" : d.type === "COA" ? "COA" : d.title} v{d.version}
                </a>
              </li>
            ))
          ) : (
            <>
              <li>
                <Link href={`/contact?topic=contact&sku=${firstSku}`} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink hover:border-accent">
                  SDS on request
                </Link>
              </li>
              <li>
                <Link href={`/contact?topic=contact&sku=${firstSku}`} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink hover:border-accent">
                  COA on request
                </Link>
              </li>
            </>
          )}
          {dilution.length > 0 || product.dilutionText ? (
            <li>
              <a href="#dilution" className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink hover:border-accent">
                Dilution chart
              </a>
            </li>
          ) : null}
        </ul>
        <p className="mt-2 text-caption text-ink-muted">Current versions, sent with your quote or order.</p>
      </section>

      {/* Who uses it, dilution, packs */}
      <section aria-label="Who uses it, dilution and pack sizes" className="mt-4 grid gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-3">
        <div className="bg-surface p-5">
          <PanelHeading icon="users">Who uses this</PanelHeading>
          {usedBy.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-small">
              {usedBy.map((i) => (
                <li key={i.slug}>
                  <Link href={`/solutions/${i.slug}`} className="text-ink underline underline-offset-[3px] hover:text-accent">
                    {i.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-small text-ink">Any site that does this cleaning job.</p>
          )}
        </div>
        <div className="bg-surface p-5">
          <PanelHeading icon="droplet">Dilution guide</PanelHeading>
          <p className="mt-2 text-small text-ink">{dilutionSummary ?? "Ask us for the dilution for your job."}</p>
        </div>
        <div className="bg-surface p-5">
          <PanelHeading icon="flask">Pack sizes</PanelHeading>
          <p className="mt-2 text-small text-ink">{sizes.length ? `${listJoin(sizes)}. Bulk and recurring orders are quoted.` : `${sizesLine([])}. Bulk and recurring orders are quoted.`}</p>
        </div>
      </section>

      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { t: "Small orders", b: "Delivered, or collected from our Mombasa Road office by arrangement." },
          { t: "Drums and bulk", b: "Scheduled delivery across Kenya, quoted before you pay." },
          { t: "Support", b: "Call or WhatsApp for dilution, pack size and delivery questions." },
        ].map((d) => (
          <li key={d.t} className="rounded-card border border-line bg-surface p-4 text-small text-ink">
            <span className="font-semibold text-accent">{d.t}:</span> {d.b}
          </li>
        ))}
      </ul>

      {/* The detail: description, dosing with the calculator, method, safety, questions, reviews */}
      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-12 lg:col-span-8">
          {product.longDescription ? (
            <section aria-labelledby="about">
              <h2 id="about" className="text-h2">
                About this product
              </h2>
              <div className="prose mt-4">
                {product.longDescription.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          ) : null}

          {dilution.length > 0 ? (
            <section aria-labelledby="dilution-heading" id="dilution" className="scroll-mt-40">
              <h2 className="text-h2" id="dilution-heading">
                Dilution and contact time
              </h2>
              <div className="mt-4">
                <DilutionTable
                  caption={`Dilution chart for ${product.name}`}
                  rows={dilution.map((r) => ({ ratio: ratioLabel(r.ratio), use: r.use, contactTime: r.contactTimeMinutes ? `${r.contactTimeMinutes} min` : "—", note: r.note }))}
                />
              </div>
              <div className="mt-6">
                <DilutionCalculator rows={dilution} packs={product.variants.map((v) => ({ label: v.packLabel, litres: litresOf(v) })).filter((p) => p.litres > 0)} />
              </div>
            </section>
          ) : product.dilutionText ? (
            <section aria-labelledby="dilution-heading" id="dilution" className="scroll-mt-40">
              <h2 id="dilution-heading" className="text-h2">
                Dilution
              </h2>
              <p className="mt-4 max-w-[62ch]">{product.dilutionText}</p>
            </section>
          ) : null}

          {product.howToUse ? (
            <section aria-labelledby="how">
              <h2 id="how" className="text-h2">
                How to use
              </h2>
              <div className="prose mt-4">
                {product.howToUse.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          ) : null}

          {product.hazardClass !== "NONE" ? (
            <section aria-labelledby="safety">
              <h2 id="safety" className="text-h2">
                Safety
              </h2>
              <div className="mt-4 flex items-start gap-3 rounded-chip bg-warning-wash p-4 text-warning-ink">
                <HazardPictogram hazard={product.hazardClass as Exclude<HazardClass, "NONE">} size={24} className="mt-0.5 shrink-0" />
                <p className="text-small">
                  <strong>{hazardLabel[product.hazardClass as HazardClass]}.</strong> Read the label and the safety data sheet before use. Wear the protective equipment it specifies, never mix with other chemicals, and store closed in the original container away from food.
                </p>
              </div>
            </section>
          ) : null}

          {faq.length > 0 ? (
            <section aria-labelledby="faq">
              <h2 id="faq" className="text-h2">
                Questions people ask
              </h2>
              <dl className="mt-4 divide-y divide-line border-y border-line">
                {faq.map((f) => (
                  <div key={f.q} className="py-4">
                    <dt className="text-h4">{f.q}</dt>
                    <dd className="mt-1 max-w-[62ch] text-body text-ink-muted">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {/* An empty reviews block tells a buyer nothing and reads as a warning, so it only appears once there is a review. */}
          {product.reviews.length > 0 ? (
            <section aria-labelledby="reviews">
              <h2 id="reviews" className="text-h2">
                Reviews
              </h2>
              {product.ratingSummary ? (
                <p className="mt-2 text-small">
                  <span className="tnum font-medium">{product.ratingSummary.average}</span> out of 5 from {product.ratingSummary.count} verified {product.ratingSummary.count === 1 ? "purchase" : "purchases"}
                </p>
              ) : null}
              <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line">
                {product.reviews.map((r) => (
                  <li key={r.id} className="py-4">
                    <p className="text-small">
                      <span className="tnum font-medium">{r.rating}/5</span>
                      {r.title ? <span className="font-medium"> · {r.title}</span> : null}
                    </p>
                    <p className="mt-1 max-w-[62ch]">{r.body}</p>
                    <p className="mt-1 text-caption text-ink-muted">
                      {r.user.name ?? "Customer"}, {new Date(r.createdAt).toLocaleDateString("en-KE", { year: "numeric", month: "short" })}
                      {r.verifiedOrderId ? ", verified purchase" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-10 lg:col-span-4">
          {[
            { id: "together", title: "Frequently bought together", items: boughtTogether },
            { id: "dispensers", title: "Compatible dispensers", items: dispensers },
            { id: "alternatives", title: "Alternatives", items: alternatives },
          ]
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.id} aria-labelledby={g.id}>
                <h2 id={g.id} className="text-h3">
                  {g.title}
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-1">
                  {g.items.map((p) => (
                    <li key={p.id}>
                      <ProductGridCard product={p} mode={mode} categorySlug={p.category.slug} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </aside>
      </div>

      {moreFromRange.length > 0 ? (
        <section aria-labelledby="more-from-range" className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="more-from-range" className="text-h2">
              Customers also look at
            </h2>
            <Link href={`/products/${category}`} className="inline-flex items-center gap-1.5 text-body font-medium text-accent hover:underline underline-offset-[3px]">
              See the whole range
              <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {moreFromRange.slice(0, 4).map((p) => (
              <li key={p.id}>
                <ProductGridCard product={p} mode={mode} categorySlug={category} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
