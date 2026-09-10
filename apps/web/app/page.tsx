import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ZONES, cn } from "@safuney/ui";
import { site } from "@/config/site";
import { getCategories, getProductsBySlug } from "@/lib/catalogue";
import { whatsappHref } from "@/lib/contact";
import { INDUSTRIES } from "@/lib/content/solutions";
import { services } from "@/lib/env";
import { faqJsonLd, jsonLdString, localBusinessJsonLd, organizationJsonLd } from "@/lib/seo/jsonld";
import { getPriceDisplayMode, getSetting } from "@/lib/settings";
import { ProductGridCard } from "@/components/catalogue/product-grid-card";
import { btn } from "@/components/marketing/buttons";
import { CtaBand } from "@/components/marketing/cta-band";
import { HeroStage } from "@/components/marketing/hero-stage";
import { Icon, type IconName } from "@/components/marketing/icons";
import { INDUSTRY_ICON } from "@/components/marketing/industry-icons";
import { QuickQuote } from "@/components/marketing/quick-quote";
import { RangeGrid } from "@/components/marketing/range-grid";
import { SectionHeading } from "@/components/marketing/section-heading";
import { TrustStrip } from "@/components/site/trust-strip";

import lineup from "@/public/brand/range-lineup.webp";

export const metadata: Metadata = {
  // Only the home page claims "/" as its canonical, and only it has a Swahili twin today. Setting
  // either on the root layout would apply them to every page that does not override them.
  alternates: { canonical: "/", languages: { en: "/", sw: "/sw" } },
};

/*
 * The home page (ADR 0017, second pass). Benchmarked against Alliance Chemical and Five Star
 * Chemicals: products and names do the talking. Headlines are a few words, sections have no lead
 * paragraph, and every block is a picture, a product or a number.
 */

const TRUST: Array<{ icon: IconName; title: string; note: string }> = [
  { icon: "sparkles", title: "76 products", note: "Dishwash to laundry" },
  { icon: "clock", title: "Priced in 1 day", note: "Send your list" },
  { icon: "truck", title: "Delivery", note: "Across Kenya" },
  { icon: "receipt", title: "eTIMS invoices", note: "KRA-compliant" },
  { icon: "shield", title: "Safety data sheets", note: "On request" },
  { icon: "factory", title: "Made in Kenya", note: `Blended in ${site.company.plant.split(",")[0]}` },
];

const WAYS_TO_BUY: Array<{ icon: IconName; title: string; note: string; cta: string; href: string; external?: boolean }> = [
  { icon: "whatsapp", title: "Order on WhatsApp", note: "Send your list or a photo of your store.", cta: "Chat now", href: whatsappHref("Hello Safuney, I would like to order:"), external: true },
  { icon: "clipboard", title: "Request a quote", note: "Bulk, a whole site, or something unlisted.", cta: "Get a quote", href: "/quote" },
  { icon: "receipt", title: "Buy on account", note: "Pay on invoice against a purchase order.", cta: "Apply", href: "/account/credit" },
];

const FAQ = [
  { q: "Do you deliver outside Nairobi?", a: `Yes, across Kenya. Our reps cover ${site.company.regions.join(", ")}. Delivery is quoted before you pay.` },
  { q: "How do I get prices?", a: "Send your list through the quote form or on WhatsApp. We reply with a priced quote within one working day." },
  { q: "Can we buy on account?", a: "Yes. Organisations that order regularly can apply to pay on invoice against a purchase order." },
  { q: "Are your invoices eTIMS-compliant?", a: "Yes. Safuney is an eTIMS-compliant supplier." },
  { q: "Do you supply safety data sheets?", a: "Yes, for every product, with your quote or order." },
  { q: "How can we pay?", a: "M-Pesa, card, cash on delivery, or on invoice with an approved credit account." },
];

export default async function HomePage() {
  const [categories, featured, mode, kraPin, vatNumber] = await Promise.all([
    getCategories(),
    getProductsBySlug(site.featuredProducts),
    getPriceDisplayMode(),
    getSetting("company.kraPin"),
    getSetting("company.vatNumber"),
  ]);
  const business = localBusinessJsonLd({ kraPin, vatNumber });
  const productTotal = categories.reduce((n, c) => n + (c.productCount ?? 0), 0);
  const popular = featured.slice(0, 6);
  const { offer } = site;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString([organizationJsonLd(), ...(business ? [business] : []), faqJsonLd(FAQ)]) }}
      />

      {/* Hero: headline, search, the products people ask for by name, two buttons. */}
      <section aria-labelledby="hero-heading" className="on-dark bg-hero overflow-hidden">
        <div className="mx-auto grid max-w-page items-center gap-12 px-5 pb-24 pt-10 md:grid-cols-12 md:gap-10 md:px-6 md:pb-28 md:pt-14">
          <div className="md:col-span-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-caption text-white/85">
              <span aria-hidden className="size-1.5 rounded-full bg-brand-lime" />
              {site.strapline}
            </p>
            <h1 id="hero-heading" className="mt-5 max-w-[16ch] text-hero text-white">
              Cleaning chemicals that cost less per clean.
            </h1>
            <p className="mt-4 text-body-lg text-white/75">{productTotal} professional products. Delivered across Kenya.</p>

            <form action="/search" method="get" role="search" aria-label="Search products" className="mt-7 flex max-w-xl gap-2 rounded-card bg-surface p-1.5 shadow-lift">
              <label htmlFor="hero-search" className="sr-only">
                Search products
              </label>
              <input
                id="hero-search"
                name="q"
                type="search"
                placeholder="Search: sanitiser, degreaser, handwash…"
                className="min-h-12 min-w-0 flex-1 rounded-button bg-surface px-3 text-body text-ink placeholder:text-stainless"
              />
              <button type="submit" className={`${btn.cta} px-5`}>
                <Icon name="search" className="size-5" />
                <span className="hidden sm:inline">Search</span>
                <span className="sr-only sm:hidden">Search</span>
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-caption text-white/70">Popular:</span>
              {popular.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/products/${p.category.slug}/${p.slug}`}
                  // Four on a phone, six from tablet up: past four they wrap into a third row.
                  className={cn(
                    "min-h-9 items-center rounded-full border border-white/20 bg-white/5 px-3 text-caption text-white/90 hover:border-white/50 hover:bg-white/10",
                    i < 4 ? "inline-flex" : "hidden sm:inline-flex",
                  )}
                >
                  {p.name}
                </Link>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="#quote" className={btn.cta}>
                Get a quote
                <Icon name="arrowRight" className="size-5" />
              </Link>
              <Link href="/products" className={btn.ghost}>
                Browse all products
              </Link>
            </div>
          </div>
          <div className="md:col-span-6">
            <HeroStage />
          </div>
        </div>
      </section>

      {/* Why buy from us, in six two-line facts, lifted over the hero's edge. */}
      <div className="relative z-10 mx-auto -mt-12 max-w-page px-5 md:-mt-14 md:px-6">
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-lift sm:grid-cols-3 lg:grid-cols-6">
          {TRUST.map((t) => (
            <li key={t.title} className="flex items-center gap-3 bg-surface p-4 md:p-5">
              <Icon name={t.icon} className="size-6 shrink-0 text-accent" />
              <p className="leading-tight">
                <span className="block text-small font-medium text-ink">{t.title}</span>
                <span className="block text-caption text-ink-muted">{t.note}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Ranges */}
      <section aria-labelledby="ranges-heading" className="mx-auto max-w-page px-5 pb-16 pt-16 md:px-6 md:pb-20 md:pt-20">
        <SectionHeading id="ranges-heading" title="Shop by range" action={<ViewAll href="/products" label="All products" />} />
        <RangeGrid categories={categories} className="mt-8" />
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-small text-ink-muted">By area:</span>
          {ZONES.map((z) => (
            <Link
              key={z.key}
              href={`/products?zone=${z.slug}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-small font-medium text-ink hover:border-stainless"
            >
              <span aria-hidden className={cn("size-2.5 rounded-full", z.swatch)} />
              {z.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Products */}
      {featured.length > 0 ? (
        <section aria-labelledby="featured-heading" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
            <SectionHeading id="featured-heading" title="The essentials" action={<ViewAll href="/products" label={`All ${productTotal} products`} />} />
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {featured.map((p) => (
                <li key={p.id}>
                  <ProductGridCard product={p} mode={mode} categorySlug={p.category.slug} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* The range, photographed, and the one number that sells a concentrate. */}
      <section aria-labelledby="value-heading" className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
        <SectionHeading id="value-heading" title="Pay for chemistry, not water." />
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
          <figure className="overflow-hidden rounded-[20px] shadow-lift lg:col-span-7">
            <Image src={lineup} alt="Five Safuney 5 L packs: SAF AUTORINSE, SAF-MULTIKLIN, SAF-GUARD HD, SANITOUCH and SANIBAC" sizes="(min-width: 1024px) 700px, 100vw" className="h-auto w-full" />
          </figure>
          <div className="lg:col-span-5">
            <ol className="grid grid-cols-3 gap-3 text-center">
              <li className="rounded-card border border-line bg-surface px-2 py-4">
                <span className="block text-h2 tnum text-ink">5 L</span>
                <span className="text-caption text-ink-muted">concentrate</span>
              </li>
              <li className="rounded-card border border-line bg-surface px-2 py-4">
                <span className="block text-h2 tnum text-accent">1:100</span>
                <span className="text-caption text-ink-muted">dilution</span>
              </li>
              <li className="rounded-card border border-line bg-surface px-2 py-4">
                <span className="block text-h2 tnum text-ink">505 L</span>
                <span className="text-caption text-ink-muted">ready to use</span>
              </li>
            </ol>
            <p className="mt-3 text-caption text-ink-muted">SAF-MULTIKLIN for general cleaning.</p>
            <Link href="/resources/dilution" className={`${btn.secondary} mt-6`}>
              <Icon name="calculator" className="size-5" />
              Dilution calculator
            </Link>
          </div>
        </div>
      </section>

      {/* Ways to buy */}
      <section aria-labelledby="buy-heading" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
          <SectionHeading id="buy-heading" title="Three ways to buy" />
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {WAYS_TO_BUY.map((w) => (
              <li key={w.title} className="flex flex-col rounded-card border border-line bg-ground p-6">
                <span className="grid size-12 place-items-center rounded-xl bg-surface text-accent shadow-card">
                  <Icon name={w.icon} />
                </span>
                <h3 className="mt-4 text-h3 text-ink">{w.title}</h3>
                <p className="mt-1 text-small text-ink-muted">{w.note}</p>
                <div className="mt-5">
                  {w.external ? (
                    <a href={w.href} target="_blank" rel="noopener noreferrer" className={btn.whatsapp}>
                      <Icon name="whatsapp" className="size-5" />
                      {w.cta}
                    </a>
                  ) : (
                    <Link href={w.href} className={btn.secondary}>
                      {w.cta}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Who we supply: names only. */}
      <section aria-labelledby="industries-heading" className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
        <SectionHeading id="industries-heading" title="Who we supply" action={<ViewAll href="/solutions" label="All solutions" />} />
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {INDUSTRIES.map((i) => (
            <li key={i.slug}>
              <Link
                href={`/solutions/${i.slug}`}
                className="flex h-full flex-col items-center gap-3 rounded-card border border-line bg-surface p-5 text-center shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-stainless hover:shadow-lift motion-reduce:transform-none"
              >
                <span className="grid size-12 place-items-center rounded-xl bg-accent-wash text-accent">
                  <Icon name={INDUSTRY_ICON[i.slug] ?? "building"} />
                </span>
                <span className="text-small font-medium text-ink">{i.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        {site.clients.length > 0 ? (
          <p className="mt-6 text-center text-small text-ink-muted">
            Customers include <span className="font-medium text-ink">{site.clients.join(", ")}</span>.
          </p>
        ) : null}
      </section>

      {/* The offer and the short form */}
      <section id="quote" aria-labelledby="quote-heading" className="scroll-mt-28 border-y border-line bg-surface">
        <div className="mx-auto grid max-w-page gap-10 px-5 py-16 md:px-6 md:py-20 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <p className="text-eyebrow uppercase text-accent">{offer.enabled ? "No charge, no obligation" : "Priced in one working day"}</p>
            <h2 id="quote-heading" className="mt-2 text-h1 text-ink">
              {offer.enabled ? offer.title : "Get a quote"}
            </h2>
            {offer.enabled ? <p className="mt-3 text-body text-ink-muted">{offer.summary}</p> : null}
            <ul className="mt-6 flex flex-col gap-3">
              {["Priced in one working day", "Dilution and pack size for each job", "Delivery quoted before you pay"].map((point) => (
                <li key={point} className="flex items-center gap-3 text-body text-ink">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cta/25 text-brand-green-ink">
                    <Icon name="check" className="size-4" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={whatsappHref("Hello Safuney, I would like to book a site survey.")} target="_blank" rel="noopener noreferrer" className={btn.whatsapp}>
                <Icon name="whatsapp" className="size-5" />
                WhatsApp
              </a>
              <a href={`tel:${site.contact.phone.e164}`} className={btn.secondary}>
                <Icon name="phone" className="size-4" />
                {site.contact.phone.display}
              </a>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="rounded-[20px] border border-line bg-ground p-6 shadow-card md:p-8">
              <h3 className="text-h3 text-ink">{offer.enabled ? "Book a survey or get a quote" : "Get a quote"}</h3>
              <div className="mt-5">
                <QuickQuote leadsEnabled={services.leads()} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading id="faq-heading" title="Questions" />
          </div>
          <div className="faq divide-y divide-line rounded-card border border-line bg-surface lg:col-span-8">
            {FAQ.map((f) => (
              <details key={f.q} className="px-5 md:px-6">
                <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3 text-h4 text-ink">
                  {f.q}
                  <span aria-hidden className="faq-sign text-h2 leading-none text-accent transition-transform">
                    +
                  </span>
                </summary>
                <p className="pb-5 text-body text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <TrustStrip facts={{ kraPin, vatNumber }} />
      <CtaBand />
    </>
  );
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-body font-medium text-accent hover:underline underline-offset-[3px]">
      {label}
      <Icon name="arrowRight" className="size-4" />
    </Link>
  );
}
