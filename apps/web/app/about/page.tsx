import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { site } from "@/config/site";
import { getCategories } from "@/lib/catalogue";
import { Crumbs } from "@/components/marketing/crumbs";
import { CtaBand } from "@/components/marketing/cta-band";
import { Icon, type IconName } from "@/components/marketing/icons";
import { SectionHeading } from "@/components/marketing/section-heading";

import lineup from "@/public/brand/range-lineup.webp";

export const metadata: Metadata = {
  title: "About Safuney",
  description: `${site.legalName} makes and supplies professional cleaning and hygiene chemicals in Kenya, with training, dosing equipment and support services. Office on Mombasa Road, Nairobi.`,
};

const PRINCIPLES: Array<{ title: string; body: string }> = [
  { title: "Correct product", body: "The right chemistry for each surface." },
  { title: "Correct dilution", body: "Measured, not poured." },
  { title: "Correct zone", body: "Colour-coded, so cloths never cross over." },
  { title: "Correct contact time", body: "Left wet long enough to work." },
];

const WAYS_TO_BUY: Array<{ icon: IconName; title: string; href: string }> = [
  { icon: "search", title: "Browse the range", href: "/products" },
  { icon: "clipboard", title: "Ask for a quote", href: "/quote" },
  { icon: "receipt", title: "Open a credit account", href: "/account/credit" },
];

export default async function AboutPage() {
  const categories = await getCategories();
  const productTotal = categories.reduce((n, c) => n + (c.productCount ?? 0), 0);
  const facts: Array<{ icon: IconName; title: string; body: string }> = [
    { icon: "factory", title: `Blended in ${site.company.plant}`, body: "Our own plant." },
    { icon: "sparkles", title: `${productTotal} products`, body: `${categories.length} ranges, dishwash to laundry.` },
    { icon: "users", title: `Reps in ${site.company.regions.length} regions`, body: site.company.regions.join(", ") + "." },
    { icon: "receipt", title: "eTIMS-compliant", body: "KRA-ready invoices." },
  ];

  return (
    <>
      <section aria-labelledby="about-heading" className="on-dark bg-hero">
        <div className="mx-auto grid max-w-page items-center gap-10 px-5 py-12 md:grid-cols-12 md:px-6 md:py-16">
          <div className="md:col-span-6">
            <Crumbs items={[{ label: "About" }]} />
            <h1 id="about-heading" className="mt-4 text-hero text-white">
              About Safuney
            </h1>
            <p className="mt-4 max-w-[40ch] text-body-lg text-white/75">
              Kenyan maker and supplier of professional cleaning and hygiene chemicals. <span className="italic text-brand-lime">{site.strapline}.</span>
            </p>
          </div>
          <div className="md:col-span-6">
            <Image src={lineup} alt="Five Safuney 5 L packs from the range" sizes="(min-width: 768px) 560px, 100vw" className="h-auto w-full rounded-[20px] shadow-lift" priority />
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-8 max-w-page px-5 md:px-6">
        <ul className="grid gap-px overflow-hidden rounded-card border border-line bg-line shadow-lift sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f) => (
            <li key={f.title} className="flex items-center gap-4 bg-surface p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-wash text-accent">
                <Icon name={f.icon} />
              </span>
              <p className="leading-tight">
                <span className="block text-h4 text-ink">{f.title}</span>
                <span className="mt-1 block text-small text-ink-muted">{f.body}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      <section aria-labelledby="principles" className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
        <SectionHeading id="principles" title="Clean, done correctly" />
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p, i) => (
            <li key={p.title} className="rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="text-eyebrow uppercase text-accent tnum">0{i + 1}</span>
              <h3 className="mt-2 text-h4 text-ink">{p.title}</h3>
              <p className="mt-1 text-small text-ink-muted">{p.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="who" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-page gap-12 px-5 py-16 md:px-6 md:py-20 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <SectionHeading id="who" title="Who we work with" />
            <ul className="mt-6 flex flex-wrap gap-2">
              {site.industries.map((i) => (
                <li key={i} className="rounded-full border border-line bg-ground px-4 py-2 text-small font-medium text-ink">
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-6">
            <h2 className="text-h2 text-ink">How to buy</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {WAYS_TO_BUY.map((w) => (
                <li key={w.title}>
                  <Link href={w.href} className="group flex h-full flex-col gap-3 rounded-card border border-line bg-ground p-5 transition hover:border-stainless hover:shadow-card">
                    <Icon name={w.icon} className="size-6 text-accent" />
                    <span className="text-h4 text-ink">{w.title}</span>
                    <Icon name="arrowRight" className="mt-auto size-4 text-accent transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-small text-ink-muted">
              {site.contact.address.lines.join(", ")}.{" "}
              <Link href="/contact" className="text-accent underline underline-offset-[3px]">
                Contact us
              </Link>
            </p>
          </div>
        </div>
      </section>

      <CtaBand id="about-cta" />
    </>
  );
}
