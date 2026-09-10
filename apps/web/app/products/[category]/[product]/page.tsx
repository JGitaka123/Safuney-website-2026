import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DilutionTable, HazardBadge, HazardPictogram, hazardLabel, ZoneBadge, type HazardClass, type ZoneKey } from "@safuney/ui";
import { money } from "@safuney/db";
import { site } from "@/config/site";
import { parseGuidance, ratioLabel } from "@/lib/catalogue/dilution";
import { parseFilters } from "@/lib/catalogue/filters";
import { getCategoryPage, getProduct, listVisibleProductPaths, stockStatus } from "@/lib/catalogue/queries";
import { productEnquiry, telHref, whatsappHref } from "@/lib/contact";
import { displayPrice } from "@/lib/pricing";
import { getPriceDisplayMode, isFeatureEnabled } from "@/lib/settings";
import { breadcrumbJsonLd, faqJsonLd, jsonLdString, productJsonLd } from "@/lib/seo/jsonld";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { DilutionCalculator } from "@/components/catalogue/dilution-calculator";
import { ProductGridCard } from "@/components/catalogue/product-grid-card";
import { PurchasePanel, type PurchaseVariant } from "@/components/catalogue/purchase-panel";
import { AvailabilityNote } from "@/components/catalogue/availability-note";
import { btn } from "@/components/marketing/buttons";
import { CtaBand } from "@/components/marketing/cta-band";
import { Icon } from "@/components/marketing/icons";

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

/** What a buyer gets whichever pack they ask about. Every line is a standing commitment elsewhere on the site. */
const ASSURANCES = ["Priced within one working day", "eTIMS-compliant invoice", "Delivery across Kenya", "Safety data sheet on request"];

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
  const image = product.images[0];

  // The rest of the range, for the buyer who landed here and wants the thing next to it.
  const rangePage = await getCategoryPage(category, parseFilters({}));
  const moreFromRange = (rangePage?.products ?? []).filter((p) => p.slug !== product.slug).slice(0, 4);

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
    <>
      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
        <Breadcrumbs items={[{ href: "/products", label: "Products" }, { href: `/products/${category}`, label: product.category.name }, { label: product.name }]} />

        <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-6">
            <figure className="bg-stage relative overflow-hidden rounded-[20px] border border-line shadow-card">
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
                    className="object-contain drop-shadow-[0_18px_24px_rgba(16,32,43,0.18)]"
                    style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
                    sizes="(min-width: 1024px) 480px, 100vw"
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

          <div className="flex min-w-0 flex-col gap-5 lg:col-span-6">
            <p className="text-small">
              <Link href={`/products/${category}`} className="font-medium text-accent hover:underline underline-offset-[3px]">
                {product.category.name}
              </Link>
              {product.brand ? <span className="text-ink-muted"> · {product.brand}</span> : null}
            </p>
            <h1 className="-mt-2 text-h1">{product.name}</h1>
            <p className="max-w-[62ch] text-body-lg text-ink-muted">{product.shortDescription}</p>
            <div className="flex flex-wrap items-center gap-2">
              {zone ? <ZoneBadge zone={zone} /> : null}
              {product.hazardClass !== "NONE" ? <HazardBadge hazard={product.hazardClass as HazardClass} /> : null}
            </div>
            <div className="rounded-[20px] border border-line bg-surface p-5 shadow-card md:p-6">
              <PurchasePanel productName={product.name} variants={variants} mode={mode} vatRateBps={vatRateBps} shopEnabled={shopEnabled} />
              {/* Server-rendered from live stock: the first pack is the one selected on arrival. */}
              {variants[0] && !product.fromSnapshot ? <AvailabilityNote variantId={variants[0].id} /> : null}
            </div>
            <ul className="grid gap-2 text-small text-ink sm:grid-cols-2">
              {ASSURANCES.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <Icon name="check" className="size-4 shrink-0 text-brand-green-ink" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-12">
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
              <section aria-labelledby="dilution">
                <h2 id="dilution" className="text-h2">
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
              <section aria-labelledby="dilution">
                <h2 id="dilution" className="text-h2">
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

            <section aria-labelledby="safety">
              <h2 id="safety" className="text-h2">
                Safety and documents
              </h2>
              {product.hazardClass !== "NONE" ? (
                <div className="mt-4 flex items-start gap-3 rounded-chip bg-warning-wash p-4 text-warning-ink">
                  <HazardPictogram hazard={product.hazardClass as Exclude<HazardClass, "NONE">} size={24} className="mt-0.5 shrink-0" />
                  <p className="text-small">
                    <strong>{hazardLabel[product.hazardClass as HazardClass]}.</strong> Read the label and the safety data sheet before use. Wear the protective equipment it specifies, never mix with other chemicals, and store closed in the original container away from food.
                  </p>
                </div>
              ) : null}
              {documents.length > 0 ? (
                <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line">
                  {documents.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span>
                        <span className="block font-medium">{d.type === "SDS" ? "Safety data sheet" : d.type === "COA" ? "Certificate of analysis" : d.title}</span>
                        <span className="block text-caption text-ink-muted">
                          Version {d.version}, {new Date(d.publishedAt).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      </span>
                      <a href={d.fileUrl} className={`${btn.secondary} min-h-11 px-4`} download>
                        Download PDF
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 max-w-[62ch] text-small">
                  The safety data sheet and certificate of analysis for this product are supplied on request.{" "}
                  <Link href={`/contact?topic=contact&sku=${product.variants[0]?.sku ?? ""}`} className="text-accent underline underline-offset-[3px]">
                    Ask us for the documents
                  </Link>
                  .
                </p>
              )}
            </section>

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
            <section aria-labelledby="help" className="on-dark bg-hero rounded-[20px] p-6 text-white shadow-lift">
              <h2 id="help" className="text-h3 text-white">
                Not sure it is the right product?
              </h2>
              <p className="mt-2 text-small text-white/75">Tell us the surface, the soil and the size of the job. We confirm the product, the dilution and the pack size.</p>
              <div className="mt-5 flex flex-col gap-3">
                <a href={whatsappHref(`Hello Safuney, I have a question about ${product.name}.`)} target="_blank" rel="noopener noreferrer" className={btn.whatsapp}>
                  <Icon name="whatsapp" className="size-5" />
                  Ask on WhatsApp
                </a>
                <a href={telHref} className={btn.ghost}>
                  <Icon name="phone" className="size-4" />
                  Call {site.contact.phone.display}
                </a>
              </div>
            </section>
            {boughtTogether.length > 0 ? (
              <section aria-labelledby="together">
                <h2 id="together" className="text-h3">
                  Frequently bought together
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-1">
                  {boughtTogether.map((p) => (
                    <li key={p.id}>
                      <ProductGridCard product={p} mode={mode} categorySlug={p.category.slug} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {dispensers.length > 0 ? (
              <section aria-labelledby="dispensers">
                <h2 id="dispensers" className="text-h3">
                  Compatible dispensers
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-1">
                  {dispensers.map((p) => (
                    <li key={p.id}>
                      <ProductGridCard product={p} mode={mode} categorySlug={p.category.slug} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {alternatives.length > 0 ? (
              <section aria-labelledby="alternatives">
                <h2 id="alternatives" className="text-h3">
                  Alternatives
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-1">
                  {alternatives.map((p) => (
                    <li key={p.id}>
                      <ProductGridCard product={p} mode={mode} categorySlug={p.category.slug} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>

        {moreFromRange.length > 0 ? (
          <section aria-labelledby="more-from-range" className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="more-from-range" className="text-h2">
                More from {product.category.name.toLowerCase()}
              </h2>
              <Link href={`/products/${category}`} className="inline-flex items-center gap-1.5 text-body font-medium text-accent hover:underline underline-offset-[3px]">
                See the whole range
                <Icon name="arrowRight" className="size-4" />
              </Link>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {moreFromRange.map((p) => (
                <li key={p.id}>
                  <ProductGridCard product={p} mode={mode} categorySlug={category} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <CtaBand
        id="product-cta"
        title={`Ordering ${product.name} in quantity?`}
        body="Tell us how much. We price it in one working day."
        whatsappText={productEnquiry(product.name)}
      />
    </>
  );
}
