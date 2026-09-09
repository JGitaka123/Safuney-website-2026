import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@safuney/ui";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Delivery and returns",
  description: `How ${site.legalName} delivers orders in Kenya, what to check when goods arrive, and how returns and damaged deliveries are handled.`,
};

export default function DeliveryAndReturnsPage() {
  const { contact } = site;
  return (
    <div className="mx-auto max-w-reading px-5 py-10 md:px-6 md:py-16">
      <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
        <Link href="/" className="hover:underline underline-offset-[3px]">
          Home
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Delivery and returns</span>
      </nav>
      <h1 className="mt-3 text-h1">Delivery and returns</h1>
      <p className="mt-3 max-w-[62ch] text-ink-muted">
        How orders reach you, what to check when they arrive, and what to do if something is wrong.
      </p>

      <div className="prose mt-8">
        <h2>Where we deliver</h2>
        <p>Orders placed online are delivered in three zones:</p>
        <ul>
          <li>Nairobi metro;</li>
          <li>Kiambu and Thika;</li>
          <li>other counties, by courier.</li>
        </ul>
        <p>
          The delivery charge depends on the zone and the weight of the order. It is quoted at checkout, before you
          pay, and confirmed on your order confirmation. If your address is outside our delivery zones, or you need a
          courier quote for a large order, <Link href="/contact?topic=quote">ask us for a quote</Link>.
        </p>

        <h2>Collecting from our office</h2>
        <p>
          You can collect your order from {contact.address.lines[0]}, Nairobi, by arrangement. Choose collection at
          checkout and we will confirm when the order is packed and ready. Call{" "}
          <a href={`tel:${contact.phone.e164}`}>{contact.phone.display}</a> before you set off so that it is waiting
          for you.
        </p>

        <h2>Delivery slots and signing</h2>
        <p>
          Choose a delivery slot at checkout. Someone must be at the address to receive and sign for the goods. If
          nobody is available, the rider will call the phone number on the order; if we cannot reach anyone, the order
          returns to our office and we will arrange another slot with you.
        </p>

        <h2>Hazardous goods</h2>
        <p>
          Concentrated cleaning chemicals are packed and labelled according to the product&rsquo;s safety data sheet:
          sealed containers, hazard labels where required, and separation of products that must not travel together.
          Store them the same way when they arrive, in their original containers, closed, away from food and out of
          reach of children.
        </p>

        <h2>When your order arrives</h2>
        <ol>
          <li>Check the consignment against the delivery note before you sign: the number of packs and their condition.</li>
          <li>Note any shortage or damage on the delivery note. The rider will countersign it.</li>
          <li>
            Report the shortage or damage to us within 48 hours of delivery, with a photo, by email to{" "}
            <a href={`mailto:${contact.email.address}`}>{contact.email.address}</a> or on WhatsApp.
          </li>
        </ol>
        <p>
          Do not use a product that has leaked or whose container is damaged. Set it aside, photograph it, and tell us.
        </p>

        <h2>Returns</h2>
        <p>
          Contact us before returning anything, so that we can agree how and when it comes back and give you a
          reference. We accept returns of goods that are unopened, undamaged and in resaleable condition. For safety
          reasons, concentrates that have been opened cannot be returned: once a seal is broken we cannot verify what is
          in the container.
        </p>
        <p>
          Refunds go back to the payment method you used: M-Pesa refunds to the number that paid, card refunds to the
          card, and account orders as a credit note against your account.
        </p>

        <h2>Incorrect or damaged deliveries</h2>
        <p>
          If we sent the wrong product, the wrong pack size, or goods arrived damaged or short, we replace or credit them
          at no cost to you, including collection of the incorrect goods. Report it within 48 hours of delivery as
          described above so that we can act on it quickly.
        </p>

        <h2>Contact</h2>
        <p>
          Delivery or returns questions: <a href={`tel:${contact.phone.e164}`}>{contact.phone.display}</a>,{" "}
          <a href={`https://wa.me/${contact.whatsapp.e164}`}>WhatsApp</a>, or{" "}
          <a href={`mailto:${contact.email.address}`}>{contact.email.address}</a>.
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/contact">Report a delivery problem</ButtonLink>
        <ButtonLink href="/terms" variant="secondary">
          Read the terms of sale
        </ButtonLink>
      </div>
    </div>
  );
}
