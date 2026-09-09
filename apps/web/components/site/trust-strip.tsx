import Link from "next/link";
import { site } from "@/config/site";

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
  const items: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: "Where we are",
      value: (
        <>
          {contact.address.lines.join(", ")}
          <span className="mt-1 block text-caption text-ink-muted">{contact.address.poBox}</span>
        </>
      ),
    },
    {
      label: "Talk to a person",
      value: (
        <>
          <a href={`tel:${contact.phone.e164}`} className="text-accent underline">
            {contact.phone.display}
          </a>
          <span className="mt-1 block">
            <a href={`https://wa.me/${contact.whatsapp.e164}`} className="text-accent underline" rel="noopener noreferrer" target="_blank">
              WhatsApp
            </a>
            {" · "}
            <a href={`mailto:${contact.email.address}`} className="text-accent underline">
              {contact.email.address}
            </a>
          </span>
        </>
      ),
    },
    {
      label: "Delivery and returns",
      value: (
        <>
          Nairobi and countrywide, quoted at checkout before you pay.
          <span className="mt-1 block">
            <Link href="/delivery-and-returns" className="text-accent underline">
              What happens if something is wrong
            </Link>
          </span>
        </>
      ),
    },
    {
      label: "How you can pay",
      value: <>M-Pesa, card, cash on delivery, or on invoice with an approved credit account.</>,
    },
  ];

  if (facts.kraPin || facts.vatNumber) {
    items.push({
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
      <div className="mx-auto max-w-page px-5 py-10 md:px-6">
        <h2 id="trust-heading" className="text-h3">
          Who you are buying from
        </h2>
        <dl className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label}>
              <dt className="text-label text-ink-muted">{item.label}</dt>
              <dd className="mt-2 text-body text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
