import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
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
  if (topic === "credit") return "Credit account enquiry\n\n";
  return "";
}

const intro: Record<LeadTopic, string> = {
  contact: "Ask about a product, a dilution, an order or anything else. We reply within one working day.",
  quote:
    "Tell us the products, pack sizes and quantities you need and where they are going, and we will send a priced quote.",
  credit:
    "Organisations that order regularly can apply for an account and pay on invoice. Tell us about your organisation and how often you expect to order.",
  services:
    "Training, equipment service and repair, and managed housekeeping. Tell us the site, the team and what you want to improve.",
};

export default async function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawTopic = first(params["topic"]);
  const topic: LeadTopic = isLeadTopic(rawTopic) ? rawTopic : "contact";
  const rawCategory = first(params["category"]);
  const category = categoryName(rawCategory);
  const { contact } = site;

  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
        <Link href="/" className="hover:underline underline-offset-[3px]">
          Home
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Contact</span>
      </nav>
      <h1 className="mt-3 text-h1">Contact Safuney</h1>
      <p className="mt-3 max-w-[62ch] text-ink-muted">{intro[topic]}</p>

      <div className="mt-10 grid gap-12 md:grid-cols-12">
        <section aria-labelledby="contact-details" className="md:col-span-5 lg:col-span-4">
          <h2 id="contact-details" className="text-h3">
            Talk to us
          </h2>
          <dl className="mt-4 grid gap-5">
            <div>
              <dt className="text-label">Phone</dt>
              <dd className="mt-1">
                <a href={`tel:${contact.phone.e164}`} className="text-accent underline underline-offset-[3px]">
                  {contact.phone.display}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-label">WhatsApp</dt>
              <dd className="mt-1">
                <a href={`https://wa.me/${contact.whatsapp.e164}`} className="text-accent underline underline-offset-[3px]">
                  Message us on WhatsApp
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-label">Email</dt>
              <dd className="mt-1">
                <a href={`mailto:${contact.email.address}`} className="text-accent underline underline-offset-[3px]">
                  {contact.email.address}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-label">Office</dt>
              <dd className="mt-1">
                <address className="not-italic">
                  {contact.address.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
                <a href={MAPS_URL} className="mt-2 inline-block text-accent underline underline-offset-[3px]">
                  Open in Google Maps
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-label">Post</dt>
              <dd className="mt-1">{contact.address.poBox}</dd>
            </div>
          </dl>
          <p className="mt-8 max-w-[40ch] text-small text-ink-muted">
            Collecting an order? Arrange a time with us first so it is packed and waiting at the office.
          </p>
        </section>

        <section aria-labelledby="contact-form-heading" className="md:col-span-7 lg:col-span-6 lg:col-start-7">
          <h2 id="contact-form-heading" className="text-h3">
            Send a message
          </h2>
          <div className="mt-4">
            <ContactForm initialTopic={topic} initialMessage={initialMessage(topic, category)} category={rawCategory && category ? rawCategory : null} />
          </div>
        </section>
      </div>
    </div>
  );
}
