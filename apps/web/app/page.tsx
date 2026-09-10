import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@safuney/ui";
import { site } from "@/config/site";
import { getCategories, getProductsBySlug } from "@/lib/catalogue";
import { telHref, whatsappHref } from "@/lib/contact";
import { INDUSTRIES } from "@/lib/content/solutions";
import { faqJsonLd, jsonLdString, localBusinessJsonLd, organizationJsonLd } from "@/lib/seo/jsonld";
import { getPriceDisplayMode, getSetting } from "@/lib/settings";
import { ProductGridCard } from "@/components/catalogue/product-grid-card";
import { btn } from "@/components/marketing/buttons";
import { HeroStage } from "@/components/marketing/hero-stage";
import { Icon, type IconName } from "@/components/marketing/icons";
import { INDUSTRY_ICON } from "@/components/marketing/industry-icons";
import { ProductRail } from "@/components/marketing/product-rail";
import { rangeMeta } from "@/components/marketing/range-meta";
import { TrustStrip } from "@/components/site/trust-strip";

import lineup from "@/public/brand/range-lineup.webp";
import dishwasher from "@/public/brand/dishwasher.webp";
import cleaningKit from "@/public/brand/cleaning-kit.webp";

export const metadata: Metadata = {
  // Only the home page claims "/" as its canonical, and only it has a Swahili twin today. Setting
  // either on the root layout would apply them to every page that does not override them.
  alternates: { canonical: "/", languages: { en: "/", sw: "/sw" } },
};

/*
 * The home page, laid out section for section on alliancechemical.com (the directors' benchmark,
 * ADR 0017): hero, six-fact strip, buying paths, shop by range, the product carousel, industries,
 * services, procurement proof, FAQ, guides. The words, photographs and colours are Safuney's own.
 */

const FACTS: Array<{ icon: IconName; title: string; note: string }> = [
  { icon: "flask", title: "76 products, 9 ranges", note: "Dishwash, laundry, washrooms and more" },
  { icon: "receipt", title: "Safety data sheets", note: "Documentation ready for audits" },
  { icon: "truck", title: "Delivery across Kenya", note: "Nairobi, Coast, Western and Nakuru" },
  { icon: "shield", title: "eTIMS-compliant supplier", note: "KRA-ready invoices" },
  { icon: "factory", title: "Made in Kenya", note: "Blended at our plant in Ruai" },
  { icon: "clock", title: "Priced in 1 working day", note: "Send a list, get a quote" },
];

const MAIN_RANGES = ["warewashing", "disinfection", "housekeeping", "laundry", "personal-hygiene", "process-hygiene"];
const MORE_RANGES = ["specialty", "bactro", "equipment"];

const RESOURCES: Array<{ icon: IconName; label: string; href: string }> = [
  { icon: "calculator", label: "Dilution calculator", href: "/resources/dilution" },
  { icon: "shield", label: "Safety data sheets", href: "/resources/safety-data-sheets" },
  { icon: "truck", label: "Delivery and returns", href: "/delivery-and-returns" },
  { icon: "sparkles", label: "Colour-coding guide", href: "/resources/colour-coding" },
];

const INDUSTRY_TINT = ["bg-amber-50 text-amber-700", "bg-rose-50 text-rose-700", "bg-emerald-50 text-emerald-700", "bg-violet-50 text-violet-700", "bg-sky-50 text-sky-700", "bg-teal-50 text-teal-700"];

const PROCUREMENT = [
  { title: "eTIMS-compliant supplier", note: "KRA-ready invoices on every order" },
  { title: "Safety data sheets", note: "For every product, on request" },
  { title: "Credit accounts", note: "Pay on invoice against an LPO" },
  { title: "Delivery across Kenya", note: "Reps in Nairobi, the Coast and Western" },
];

const FAQ = [
  {
    q: "What does Safuney supply?",
    a: "76 professional cleaning and hygiene products in nine ranges: warewashing, disinfection and sanitisation, speciality products, personal hygiene, housekeeping, food and process hygiene, laundry, the Bactro biological range, and cleaning equipment. Most come as 5 L and 20 L concentrates.",
  },
  { q: "How do I get prices?", a: "Send your list through the quote form or on WhatsApp. We reply with a priced quote within one working day." },
  {
    q: "Do you deliver outside Nairobi?",
    a: `Yes, across Kenya. Our sales reps cover ${site.company.regions.join(", ")}, and delivery is quoted before you pay.`,
  },
  { q: "Can we buy on account?", a: "Yes. Organisations that order regularly can apply for a credit account and pay on invoice against an LPO." },
  { q: "Do you supply safety data sheets and eTIMS invoices?", a: "Yes. The current safety data sheet for any product comes with your quote or order, and every invoice is eTIMS-compliant." },
];

const GUIDES: Array<{ icon: IconName; title: string; note: string; href: string; tint: string }> = [
  { icon: "sparkles", title: "The colour-coding guide", note: "Red, blue, green and yellow zones, and how to keep cloths from crossing over.", href: "/resources/colour-coding", tint: "bg-rose-50 text-rose-700" },
  { icon: "calculator", title: "Dilution calculator", note: "How much concentrate to measure for a bucket, a bottle or a machine.", href: "/resources/dilution", tint: "bg-sky-50 text-sky-700" },
  { icon: "clipboard", title: "Safety data sheets", note: "The current sheet for every product, for your site file and your auditor.", href: "/resources/safety-data-sheets", tint: "bg-emerald-50 text-emerald-700" },
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
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const main = MAIN_RANGES.flatMap((s) => (bySlug.get(s) ? [bySlug.get(s)!] : []));
  const more = MORE_RANGES.flatMap((s) => (bySlug.get(s) ? [bySlug.get(s)!] : []));
  const popular = featured.slice(0, 6);
  const alsoServe = ["Agricultural", "Gaming and recreation", "Country clubs", "Maintenance contractors"];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString([organizationJsonLd(), ...(business ? [business] : []), faqJsonLd(FAQ)]) }}
      />

      {/* Hero */}
      <section aria-labelledby="hero-heading" className="on-dark bg-hero overflow-hidden">
        <div className="mx-auto grid max-w-page items-center gap-10 px-5 py-12 md:grid-cols-12 md:px-6 md:py-16">
          <div className="md:col-span-7">
            <p className="text-eyebrow text-brand-lime">Cleaning and hygiene chemicals, made in Kenya</p>
            <h1 id="hero-heading" className="mt-4 text-hero text-white">
              Professional Cleaning Chemicals. Delivered Across Kenya.
            </h1>
            <p className="mt-5 max-w-[52ch] text-body-lg text-white/80">
              Order by the jerrycan or the drum, or work with our sales team on bulk and recurring supply for the whole site.
            </p>
            <p className="mt-3 text-body text-white/80">Priced within one working day.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/products" className={btn.cta}>
                Shop Products
              </Link>
              <Link href="/quote" className={btn.ghost}>
                Request a Quote
              </Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-small font-semibold text-white">
              <li>
                <a href={whatsappHref("Hello Safuney, I would like to order:")} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Order on WhatsApp
                </a>
              </li>
              <li>
                <Link href="/resources/safety-data-sheets" className="hover:underline">
                  Safety data sheets
                </Link>
              </li>
              <li>
                <Link href="/account/credit" className="hover:underline">
                  Open a credit account
                </Link>
              </li>
              <li>
                <a href={telHref} className="hover:underline">
                  Call sales: {site.contact.phone.display}
                </a>
              </li>
            </ul>
            <p className="mt-4 text-small font-semibold text-white/90">Nairobi cleaning chemicals supplier, blended in {site.company.plant}</p>
          </div>
          <div className="md:col-span-5">
            <HeroStage cards={false} />
          </div>
        </div>
      </section>

      {/* Six facts */}
      <section aria-label="Why buy from Safuney" className="border-b border-line bg-[#f8fafc]">
        <ul className="mx-auto grid max-w-page grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {FACTS.map((f, i) => (
            <li key={f.title} className={cn("flex flex-col gap-2 border-line px-5 py-6 md:px-6", i % 2 === 1 && "border-l", "md:border-l", i % 3 === 0 && "md:border-l-0", "lg:border-l", i === 0 && "lg:border-l-0", i >= 2 && "border-t md:border-t-0", i >= 3 && "md:border-t lg:border-t-0")}>
              <Icon name={f.icon} className="size-7 text-accent" />
              <p className="text-body font-semibold text-ink">{f.title}</p>
              <p className="text-small text-ink-muted">{f.note}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Buying paths */}
      <section aria-labelledby="paths-heading" className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
        <p className="text-eyebrow text-accent">Choose your buying path</p>
        <h2 id="paths-heading" className="mt-3 max-w-[22ch] text-hero text-ink">
          Order by the jerrycan or by the pallet, the way your site works.
        </h2>
        <p className="mt-4 max-w-[60ch] text-body-lg text-ink-muted">Order on WhatsApp, request a quote for bulk and recurring supply, or send us your LPO.</p>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          <li className="flex flex-col rounded-card border-2 border-accent bg-accent-wash/60 p-7 shadow-lift">
            <span className="grid size-14 place-items-center rounded-xl bg-surface text-accent">
              <Icon name="whatsapp" className="size-7" />
            </span>
            <p className="mt-6 text-eyebrow text-accent">Order on WhatsApp</p>
            <h3 className="mt-2 text-h2 text-ink">Any pack, any quantity</h3>
            <p className="mt-2 text-body text-ink-muted">Send your list or a photo of your store. We confirm the price and delivery.</p>
            <div className="mt-auto pt-7">
              <a href={whatsappHref("Hello Safuney, I would like to order:")} target="_blank" rel="noopener noreferrer" className={btn.cta}>
                Order on WhatsApp
              </a>
            </div>
          </li>
          <li className="flex flex-col rounded-card border border-line bg-surface p-7">
            <span className="grid size-14 place-items-center rounded-xl bg-accent-wash text-accent">
              <Icon name="clipboard" className="size-7" />
            </span>
            <p className="mt-6 text-eyebrow text-accent">Request a quote</p>
            <h3 className="mt-2 text-h2 text-ink">Bulk, whole-site and recurring supply</h3>
            <p className="mt-2 text-body text-ink-muted">Contract pricing, scheduled delivery and credit terms.</p>
            <div className="mt-auto pt-7">
              <Link href="/quote" className={btn.outline}>
                Request a Quote
              </Link>
            </div>
          </li>
          <li className="flex flex-col rounded-card border border-line bg-surface p-7">
            <span className="grid size-14 place-items-center rounded-xl bg-ground-deep text-ink">
              <Icon name="receipt" className="size-7" />
            </span>
            <p className="mt-6 text-eyebrow text-accent">Submit a purchase order</p>
            <h3 className="mt-2 text-h2 text-ink">Send your LPO to our sales team</h3>
            <p className="mt-2 text-body text-ink-muted">Email your LPO for confirmation and delivery.</p>
            <div className="mt-auto pt-7">
              <a href={`mailto:${site.contact.email.address}?subject=${encodeURIComponent("LPO")}`} className={btn.secondary}>
                Email your LPO
              </a>
            </div>
          </li>
        </ul>
      </section>

      {/* Shop by range */}
      <section aria-labelledby="ranges-heading" className="mx-auto max-w-page px-5 pb-16 md:px-6 md:pb-20">
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="on-dark bg-hero flex flex-col rounded-[20px] p-7 text-white md:p-9 lg:col-span-4">
            <p className="text-eyebrow text-brand-lime">Shop by range</p>
            <h2 id="ranges-heading" className="mt-3 text-h1 text-white">
              Find the right product faster
            </h2>
            <p className="mt-3 text-body text-white/80">Start with a range, jump straight to a product, or browse the whole catalogue.</p>
            <div className="mt-6">
              <Link href="/products" className="inline-flex min-h-12 items-center gap-2 rounded-button bg-surface px-6 text-button font-medium text-ink hover:bg-accent-wash">
                View all products
                <Icon name="arrowRight" className="size-4" />
              </Link>
            </div>
            <form action="/search" method="get" role="search" aria-label="Search the catalogue" className="mt-8">
              <label htmlFor="range-search" className="text-small font-semibold text-white">
                Search the catalogue
              </label>
              <div className="relative mt-2">
                <input
                  id="range-search"
                  name="q"
                  type="search"
                  placeholder="Product name or use…"
                  className="block min-h-12 w-full rounded-full border-0 bg-surface pl-5 pr-14 text-body text-ink placeholder:text-stainless"
                />
                <button type="submit" aria-label="Search the catalogue" className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-accent text-white hover:bg-accent-deep">
                  <Icon name="search" className="size-4" />
                </button>
              </div>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-caption font-semibold uppercase tracking-wide text-white/80">Popular</span>
              {popular.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.category.slug}/${p.slug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-white/25 bg-white/5 px-3 text-caption font-medium text-white hover:bg-white/15"
                >
                  {p.name}
                </Link>
              ))}
            </div>
            <p className="mt-auto border-t border-white/15 pt-5 text-small text-white/80">
              Prefer to order by phone?{" "}
              <a href={telHref} className="font-semibold text-white hover:underline">
                {site.contact.phone.display}
              </a>
            </p>
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 lg:col-span-8">
            {main.map((c) => {
              const meta = rangeMeta(c.slug);
              return (
                <li key={c.slug}>
                  <div className={cn("flex h-full flex-col rounded-card border border-l-4 border-line bg-surface p-5 shadow-card", meta.border)}>
                    <div className="flex items-center gap-3">
                      <span className={cn("rounded-chip px-2 py-0.5 font-mono text-mono-sm ring-1", meta.badge)}>{meta.code}</span>
                      <h3 className="text-h4 text-ink">{meta.short}</h3>
                    </div>
                    <ul className="mt-3 divide-y divide-line">
                      {c.topItems.map((p) => (
                        <li key={p.slug}>
                          <Link href={`/products/${c.slug}/${p.slug}`} className="flex min-h-10 items-center justify-between gap-3 py-1.5 text-small text-ink hover:text-accent">
                            <span className="flex min-w-0 items-center gap-2">
                              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-stainless/50" />
                              <span className="truncate">{p.name}</span>
                            </span>
                            {p.packs ? <span className="shrink-0 font-mono text-mono-sm text-ink-muted">{p.packs}</span> : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link href={`/products/${c.slug}`} className={cn("mt-auto inline-flex items-center gap-1 pt-3 text-small font-semibold hover:underline", meta.text)}>
                      Browse {meta.short.toLowerCase()}, {c.productCount} products
                      <Icon name="arrowRight" className="size-4" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-5 grid gap-6 rounded-card border border-line bg-surface p-5 md:p-6">
          <div>
            <p className="text-label uppercase tracking-wide text-ink-muted">More ranges</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {more.map((c) => (
                <li key={c.slug}>
                  <Link href={`/products/${c.slug}`} className="flex min-h-12 items-center justify-between gap-3 rounded-chip border border-line bg-ground px-4 text-small font-medium text-ink hover:border-stainless hover:text-accent">
                    <span className="flex items-center gap-2">
                      <span className={cn("rounded-chip px-1.5 font-mono text-mono-sm ring-1", rangeMeta(c.slug).badge)}>{rangeMeta(c.slug).code}</span>
                      {c.name}
                    </span>
                    <Icon name="arrowRight" className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-label uppercase tracking-wide text-ink-muted">Technical resources</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {RESOURCES.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="flex min-h-12 items-center justify-between gap-3 rounded-chip border border-line bg-ground px-4 text-small font-medium text-ink hover:border-stainless hover:text-accent">
                    <span className="flex items-center gap-2">
                      <Icon name={r.icon} className="size-4 text-ink-muted" />
                      {r.label}
                    </span>
                    <Icon name="arrowRight" className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Products */}
      {featured.length > 0 ? (
        <section aria-labelledby="featured-heading" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
            <p className="text-eyebrow text-accent">Ready to order</p>
            <h2 id="featured-heading" className="mt-3 text-h1 text-ink">
              Cleaning essentials for every site
            </h2>
            <p className="mt-3 max-w-[60ch] text-body-lg text-ink-muted">Real pack sizes and dosing on every page. Priced within one working day.</p>
            <div className="mt-10">
              <ProductRail label="Cleaning essentials">
                {featured.map((p) => (
                  <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc(25%-12px)]">
                    <ProductGridCard product={p} mode={mode} categorySlug={p.category.slug} />
                  </li>
                ))}
              </ProductRail>
            </div>
            <div className="mt-8 text-center">
              <Link href="/products" className={btn.cta}>
                Shop All Products
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Industries */}
      <section aria-labelledby="industries-heading" className="bg-sand">
        <div className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
          <h2 id="industries-heading" className="text-h1 text-ink">
            Hygiene Programmes for the Work You Do
          </h2>
          <p className="mt-3 max-w-[60ch] text-body-lg text-ink-muted">Product lists, dilutions and training for each kind of site, whether it is a kitchen, a ward or a laundry.</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.slice(0, 6).map((i, n) => (
              <li key={i.slug}>
                <Link href={`/solutions/${i.slug}`} className="group flex h-full flex-col rounded-card border border-line bg-surface p-6 transition-shadow hover:shadow-lift">
                  <span className={cn("grid size-11 place-items-center rounded-xl", INDUSTRY_TINT[n % INDUSTRY_TINT.length])}>
                    <Icon name={INDUSTRY_ICON[i.slug] ?? "building"} />
                  </span>
                  <h3 className="mt-5 text-h4 text-ink">{i.name}</h3>
                  <p className="mt-2 text-small text-ink-muted">{i.summary}</p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-5 text-small font-semibold text-accent">
                    View programme
                    <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-center text-label uppercase tracking-wide text-ink-muted">We also serve</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            <li>
              <Link href="/solutions/facilities-management" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-small text-ink hover:border-stainless">
                <Icon name="building" className="size-4 text-accent" />
                Facilities management
              </Link>
            </li>
            {alsoServe.map((a) => (
              <li key={a} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-small text-ink">
                {a}
              </li>
            ))}
          </ul>
          <div className="mt-8 text-center">
            <Link href="/solutions" className={btn.outline}>
              View all solutions
              <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section aria-labelledby="services-heading" className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
        <div className="text-center">
          <p className="text-eyebrow text-accent">Support services</p>
          <h2 id="services-heading" className="mt-3 text-h1 text-ink">
            More than a catalogue
          </h2>
          <p className="mx-auto mt-3 max-w-[62ch] text-body-lg text-ink-muted">We supply the chemicals, fit and service the dosing, and train the people who use them.</p>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { img: lineup, fit: "object-cover", title: "Chemical supply", body: "76 products in nine ranges, from 5 L jerrycans to 20 L drums, delivered across Kenya.", href: "/products", cta: "Browse all products" },
            { img: dishwasher, fit: "object-contain p-6 bg-stage", title: "Dosing and equipment service", body: "Dispensers, dosing systems and machines fitted and kept working, so every dilution is right.", href: "/services", cta: "Explore our services" },
            { img: cleaningKit, fit: "object-cover", title: "Training and housekeeping", body: "On-site training for kitchen, laundry and housekeeping teams, and managed housekeeping.", href: "/quote", cta: "Request a quote" },
          ].map((s) => (
            <li key={s.title} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image src={s.img} alt="" fill sizes="(min-width: 768px) 380px, 100vw" className={s.fit} />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-h3 text-ink">{s.title}</h3>
                <p className="mt-2 text-body text-ink-muted">{s.body}</p>
                <Link href={s.href} className="mt-auto inline-flex items-center gap-1 pt-5 text-small font-semibold text-accent underline underline-offset-[3px]">
                  {s.cta}
                  <Icon name="arrowRight" className="size-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Procurement proof */}
      <section aria-labelledby="procurement-heading" className="bg-hero">
        <div className="mx-auto grid max-w-page gap-10 px-5 py-16 md:px-6 md:py-20 lg:grid-cols-2 lg:items-start">
          <div className="on-dark text-white">
            <p className="text-eyebrow text-brand-lime">Trust and procurement</p>
            <h2 id="procurement-heading" className="mt-3 text-h1 text-white">
              Procurement-ready for hotels, hospitals and institutions
            </h2>
            <p className="mt-3 text-body-lg text-white/80">From a single jerrycan to a whole site&rsquo;s monthly supply, every order comes with the paperwork your process expects.</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {PROCUREMENT.map((p) => (
                <li key={p.title} className="rounded-card border border-white/15 bg-white/5 p-5">
                  <p className="text-body font-semibold text-white">{p.title}</p>
                  <p className="mt-1 text-small text-white/80">{p.note}</p>
                </li>
              ))}
            </ul>
            {site.clients.length > 0 ? (
              <p className="mt-8 text-small text-white/80">
                Customers include <span className="font-semibold text-white">{site.clients.join(", ")}</span>.
              </p>
            ) : null}
          </div>
          <TrustStrip facts={{ kraPin, vatNumber }} variant="card" />
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="faq-heading" className="text-h1 text-ink">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-body-lg text-ink-muted">Common questions from buyers, housekeepers and kitchen managers.</p>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-7">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-card border border-line bg-surface shadow-card">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-h4 text-ink md:px-6 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-white group-open:bg-cta group-open:text-ink">
                    <span className="text-body leading-none group-open:hidden">+</span>
                    <span className="hidden text-body leading-none group-open:inline">−</span>
                  </span>
                </summary>
                <p className="px-5 pb-5 text-body text-ink-muted md:px-6">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-lift md:flex-row md:items-center md:justify-between md:p-7">
          <div>
            <h3 className="text-h3 text-ink">Still have questions?</h3>
            <p className="mt-1 text-body text-ink-muted">Talk to our team for answers on products, dilution and delivery.</p>
            <p className="mt-2 font-mono text-mono-sm text-ink-muted">Reply within one working day · eTIMS-compliant invoices</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href={telHref} className={btn.brand}>
              <Icon name="phone" className="size-5" />
              {site.contact.phone.display}
            </a>
            <a href={whatsappHref("Hello Safuney, I have a question:")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-small font-semibold text-accent hover:underline">
              Ask on WhatsApp
              <Icon name="arrowRight" className="size-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Guides */}
      <section aria-labelledby="guides-heading" className="border-t border-line bg-ground-deep/50">
        <div className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="guides-heading" className="text-h1 text-ink">
              Technical Guides and Safety Data
            </h2>
            <Link href="/resources" className={`${btn.brand} ${btn.sm} rounded-full`}>
              View all
            </Link>
          </div>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {GUIDES.map((g) => (
              <li key={g.href}>
                <Link href={g.href} className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-shadow hover:shadow-lift">
                  <span className={cn("grid aspect-[16/7] place-items-center", g.tint)}>
                    <Icon name={g.icon} className="size-14" />
                  </span>
                  <span className="flex flex-1 flex-col p-6">
                    <span className="text-h4 text-ink">{g.title}</span>
                    <span className="mt-2 text-small text-ink-muted">{g.note}</span>
                    <span className="mt-auto pt-4 text-small font-semibold text-accent underline underline-offset-[3px]">Read the guide</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
