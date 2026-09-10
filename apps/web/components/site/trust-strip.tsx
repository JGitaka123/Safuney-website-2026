import Link from "next/link";
import { site } from "@/config/site";
import { whatsappHref } from "@/lib/contact";
import { Icon, type IconName } from "@/components/marketing/icons";

export interface TrustFacts {
  kraPin: string;
  vatNumber: string;
}

/**
 * The row of facts a business buyer checks before ordering from a supplier they have not used.
 *
 * Every item is something we can actually stand behind. The tax identifiers appear only once the PO
 * has entered them in the admin console — a supplier that shows a blank KRA PIN reads worse than one
 * that shows none, and an invented one is a liability. Payment marks are words rather than logos: we
 * have no licence to reproduce the M-Pesa or Paystack marks, and a wrong logo is worse than none.
 */
export function TrustStrip({ facts }: { facts: TrustFacts }) {
  const { contact } = site;
  const items: Array<{ icon: IconName; label: string; value: React.ReactNode }> = [
    {
      icon: "mapPin",
      label: "Where we are",
      value: (
        <>
          {contact.address.lines.join(", ")}
          <span className="mt-1 block text-caption text-ink-muted">{contact.address.poBox}</span>
        </>
      ),
    },
    {
      icon: "phone",
      label: "Talk to a person",
      value: (
        <>
          <a href={`tel:${contact.phone.e164}`} className="font-medium text-accent underline underline-offset-[3px]">
            {contact.phone.display}
          </a>
          <span className="mt-1 block">
            <a href={whatsappHref()} className="text-accent underline underline-offset-[3px]" rel="noopener noreferrer" target="_blank">
              WhatsApp
            </a>
            {" or "}
            <a href={`mailto:${contact.email.address}`} className="text-accent underline underline-offset-[3px]">
              {contact.email.address}
            </a>
          </span>
        </>
      ),
    },
    {
      icon: "truck",
      label: "Delivery and returns",
      value: (
        <>
          Nairobi and countrywide, quoted before you pay.
          <span className="mt-1 block">
            <Link href="/delivery-and-returns" className="text-accent underline underline-offset-[3px]">
              What happens if something is wrong
            </Link>
          </span>
        </>
      ),
    },
    {
      icon: "receipt",
      label: "How you can pay",
      value: <>M-Pesa, card, cash on delivery, or on invoice with an approved credit account.</>,
    },
  ];

  if (facts.kraPin || facts.vatNumber) {
    items.push({
      icon: "shield",
      label: "Registered",
      value: (
        <>
          {site.legalName}
          {facts.kraPin ? <span className="mt-1 block">KRA PIN {facts.kraPin}</span> : null}
          {facts.vatNumber ? <span className="block">VAT {facts.vatNumber}</span> : null}
        </>
      ),
    });
  }

  return (
    <section aria-labelledby="trust-heading" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-page px-5 py-14 md:px-6 md:py-16">
        <h2 id="trust-heading" className="text-h2">
          Who you are buying from
        </h2>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* The icon sits inside the <dt>: a <dl> group may hold only <dt> and <dd>. */}
          {items.map((item) => (
            <div key={item.label} className="relative min-h-11 pl-15">
              <dt className="text-label text-ink-muted">
                <span aria-hidden className="absolute left-0 top-0 grid size-11 place-items-center rounded-full bg-accent-wash text-accent">
                  <Icon name={item.icon} className="size-5" />
                </span>
                {item.label}
              </dt>
              <dd className="mt-1 text-body text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
