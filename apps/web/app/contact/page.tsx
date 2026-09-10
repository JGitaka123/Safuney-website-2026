import type { Metadata } from "next";
import { site } from "@/config/site";
import { whatsappHref } from "@/lib/contact";
import { services } from "@/lib/env";
import { Crumbs } from "@/components/marketing/crumbs";
import { Icon, type IconName } from "@/components/marketing/icons";
import { QuickQuote } from "@/components/marketing/quick-quote";
import { isLeadTopic, type LeadTopic } from "./topics";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: `Call, WhatsApp or email ${site.legalName} in Nairobi, or send a message, quote request or credit-account enquiry.`,
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Park+View+Heights+Mombasa+Road+Nairobi";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Resolve a category slug from the query string to a product area or service name we actually offer. */
function categoryName(slug: string | undefined): string | null {
  if (!slug) return null;
  const area = site.productAreas.find((a) => a.slug === slug);
  if (area) return area.name;
  const service = site.services.find((s) => s.slug === slug);
  return service ? service.name : null;
}

function initialMessage(topic: LeadTopic, category: string | null): string {
  if (topic === "quote" && category) return `Quote request: ${category}\n\n`;
  if (topic === "services" && category) return `Support services: ${category}\n\n`;
  if (topic === "services") return "Support services: I would like to book a site survey.\n\n";
  if (topic === "credit") return "Credit account enquiry\n\n";
  return "";
}

const intro: Record<LeadTopic, string> = {
  contact: "Ask about a product, a dilution, an order or anything else. We reply within one working day.",
  quote: "Tell us the products, pack sizes and quantities you need and where they are going, and we will send a priced quote.",
  credit: "Organisations that order regularly can apply for an account and pay on invoice. Tell us about your organisation and how often you expect to order.",
  services: "Training, equipment service and repair, and managed housekeeping. Tell us the site, the team and what you want to improve.",
};

export default async function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawTopic = first(params["topic"]);
  const topic: LeadTopic = isLeadTopic(rawTopic) ? rawTopic : "contact";
  const rawCategory = first(params["category"]);
  const category = categoryName(rawCategory);
  const { contact } = site;

  const channels: Array<{ icon: IconName; label: string; body: React.ReactNode }> = [
    {
      icon: "phone",
      label: "Phone",
      // All three lines the catalogue prints. It does not say which is which, so neither do we.
      body: (
        <span className="flex flex-col gap-1">
          {[contact.phone, ...contact.alternatePhones].map((line) => (
            <a key={line.e164} href={`tel:${line.e164}`} className="font-medium text-accent underline underline-offset-[3px]">
              {line.display}
            </a>
          ))}
        </span>
      ),
    },
    {
      icon: "whatsapp",
      label: "WhatsApp",
      body: (
        <a href={whatsappHref("Hello Safuney, ")} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-[3px]">
          Message us on WhatsApp
        </a>
      ),
    },
    {
      icon: "mail",
      label: "Email",
      body: (
        <a href={`mailto:${contact.email.address}`} className="font-medium text-accent underline underline-offset-[3px]">
          {contact.email.address}
        </a>
      ),
    },
    {
      icon: "mapPin",
      label: "Office",
      body: (
        <>
          <address className="not-italic">
            {contact.address.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            <span className="mt-1 block text-small text-ink-muted">{contact.address.poBox}</span>
          </address>
          <a href={MAPS_URL} className="mt-2 inline-block text-small text-accent underline underline-offset-[3px]">
            Open in Google Maps
          </a>
        </>
      ),
    },
  ];

  return (
    <>
      <section aria-labelledby="contact-heading" className="on-dark bg-hero">
        <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-14">
          <Crumbs items={[{ label: "Contact" }]} />
          <h1 id="contact-heading" className="mt-4 text-h1 text-white">
            Contact Safuney
          </h1>
          <p className="mt-3 max-w-[60ch] text-body-lg text-white/75">{intro[topic]}</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-page gap-10 px-5 py-10 md:px-6 md:py-14 lg:grid-cols-12">
        <section aria-labelledby="contact-details" className="lg:col-span-5">
          <h2 id="contact-details" className="text-h3">
            Talk to us
          </h2>
          <dl className="mt-5 grid gap-4">
            {/* The icon sits inside the <dt>: a <dl> group may hold only <dt> and <dd>. */}
            {channels.map((c) => (
              <div key={c.label} className="relative rounded-card border border-line bg-surface py-5 pl-20 pr-5 shadow-card">
                <dt className="text-label text-ink-muted">
                  <span aria-hidden className="absolute left-5 top-5 grid size-11 place-items-center rounded-full bg-accent-wash text-accent">
                    <Icon name={c.icon} className="size-5" />
                  </span>
                  {c.label}
                </dt>
                <dd className="mt-1 text-body text-ink">{c.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-[44ch] text-small text-ink-muted">Collecting an order? Arrange a time with us first so it is packed and waiting at the office.</p>
        </section>

        <section aria-labelledby="contact-form-heading" className="lg:col-span-7">
          <div className="rounded-[20px] border border-line bg-surface p-6 shadow-card md:p-8">
            <h2 id="contact-form-heading" className="text-h3">
              Send a message
            </h2>
            <div className="mt-5">
              {services.leads() ? (
                <ContactForm initialTopic={topic} initialMessage={initialMessage(topic, category)} category={rawCategory && category ? rawCategory : null} />
              ) : (
                // Nowhere to store or email a message yet: hand it to WhatsApp rather than let the form fail.
                <QuickQuote leadsEnabled={false} initialNeed={initialMessage(topic, category).trim()} />
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
