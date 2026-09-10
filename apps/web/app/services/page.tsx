import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { site } from "@/config/site";
import { whatsappHref } from "@/lib/contact";
import { btn } from "@/components/marketing/buttons";
import { Crumbs } from "@/components/marketing/crumbs";
import { CtaBand } from "@/components/marketing/cta-band";
import { Icon, type IconName } from "@/components/marketing/icons";
import { SectionHeading } from "@/components/marketing/section-heading";

import cleaningKit from "@/public/brand/cleaning-kit.webp";

export const metadata: Metadata = {
  title: "Support services",
  description: "Training, equipment service and repair, and managed housekeeping from Safuney Limited, Nairobi.",
};

const SERVICE_ICON: Record<string, IconName> = { training: "users", equipment: "wrench", housekeeping: "sparkles" };

const PROGRAMME: Array<{ icon: IconName; title: string }> = [
  { icon: "flask", title: "The right chemicals" },
  { icon: "droplet", title: "Dosing that holds the ratio" },
  { icon: "users", title: "Trained staff" },
  { icon: "clipboard", title: "Records for your auditor" },
];

export default function ServicesPage() {
  const survey = site.offer.enabled;
  return (
    <>
      <section aria-labelledby="services-heading" className="on-dark bg-hero">
        <div className="mx-auto grid max-w-page items-center gap-10 px-5 py-12 md:grid-cols-12 md:px-6 md:py-16">
          <div className="md:col-span-7">
            <Crumbs items={[{ label: "Services" }]} />
            <h1 id="services-heading" className="mt-4 max-w-[18ch] text-hero text-white">
              Chemicals, dosing and training. One supplier.
            </h1>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact?topic=services" className={btn.cta}>
                {survey ? "Book a free site survey" : "Ask about services"}
                <Icon name="arrowRight" className="size-5" />
              </Link>
              <a href={whatsappHref("Hello Safuney, I would like to ask about your support services.")} target="_blank" rel="noopener noreferrer" className={btn.ghost}>
                <Icon name="whatsapp" className="size-5 text-whatsapp" />
                WhatsApp
              </a>
            </div>
          </div>
          <div className="hidden md:col-span-5 md:block">
            <Image src={cleaningKit} alt="" sizes="(min-width: 768px) 460px, 100vw" className="h-auto w-full rounded-[20px] shadow-lift" />
          </div>
        </div>
      </section>

      <section aria-labelledby="service-lines" className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
        <SectionHeading id="service-lines" title="What we do on site" />
        <ul className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
          {site.services.map((svc) => (
            <li key={svc.slug} id={svc.slug} className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-card md:p-7">
              <span className="grid size-12 place-items-center rounded-xl bg-accent-wash text-accent">
                <Icon name={SERVICE_ICON[svc.slug] ?? "sparkles"} />
              </span>
              <h3 className="mt-5 text-h3 text-ink">{svc.name}</h3>
              <p className="mt-2 text-body text-ink-muted">{svc.blurb}</p>
              <Link href={`/contact?topic=services&category=${svc.slug}`} className="mt-auto inline-flex items-center gap-1.5 pt-5 text-small font-medium text-accent hover:underline underline-offset-[3px]">
                Ask about {svc.name.toLowerCase()}
                <Icon name="arrowRight" className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="programme" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-20">
          <SectionHeading id="programme" title="One programme, four parts" />
          <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {PROGRAMME.map((p) => (
              <li key={p.title} className="flex flex-col items-start gap-4 rounded-card border border-line bg-ground p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-surface text-accent shadow-card">
                  <Icon name={p.icon} />
                </span>
                <h3 className="text-h4 text-ink">{p.title}</h3>
              </li>
            ))}
          </ul>
          {survey ? (
            <p className="mt-8 max-w-[62ch] text-body text-ink-muted">
              <span className="font-medium text-ink">{site.offer.title}.</span> {site.offer.summary}
            </p>
          ) : null}
        </div>
      </section>

      <CtaBand id="services-cta" title="Let us look at your site." body="We come back with products, dosing, training and a cost per clean." quoteHref="/contact?topic=services" whatsappText="Hello Safuney, I would like to book a site survey." />
    </>
  );
}
