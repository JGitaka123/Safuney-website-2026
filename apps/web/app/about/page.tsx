import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@safuney/ui";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "About Safuney",
  description: `${site.legalName} is an independent supplier of professional cleaning and hygiene chemicals and support services, based on Mombasa Road, Nairobi.`,
};

export default function AboutPage() {
  const { contact } = site;
  return (
    <div className="mx-auto max-w-reading px-5 py-10 md:px-6 md:py-16">
      <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
        <Link href="/" className="hover:underline underline-offset-[3px]">
          Home
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">About</span>
      </nav>
      <h1 className="mt-3 text-h1">About Safuney</h1>
      <p className="mt-3 max-w-[62ch] text-ink-muted">
        An independent supplier of professional cleaning and hygiene chemicals, and the training, equipment service and
        housekeeping support that make them work.
      </p>

      <div className="prose mt-8">
        <h2>Who we are</h2>
        <p>
          {site.legalName} supplies professional cleaning and hygiene products to institutional, hospitality, industrial
          and commercial customers in Kenya. We are independent: we choose products on how they perform in a commercial
          kitchen, a ward, a washroom or a laundry, not on who makes them. Our office is at {contact.address.lines[0]},
          Nairobi.
        </p>
        <p>
          The range covers foodservice and kitchen hygiene, disinfection and sanitisation, laundry, housekeeping and
          janitorial, healthcare and medical equipment, laboratory, specialty products and personal hygiene. It keeps
          growing as customers bring us new cleaning problems.
        </p>

        <h2>Clinical confidence, in practice</h2>
        <p>
          Most cleaning failures are not caused by a weak product. They are caused by the right product used the wrong
          way. Clinical confidence means that anyone on your team, on any shift, can get the same result. In practice it
          comes down to four things:
        </p>
        <ul>
          <li>
            <strong>Correct product.</strong> A degreaser for the fryer, a food-contact sanitiser for the prep bench, a
            chlorine disinfectant where a chlorine disinfectant is needed. Every product on this site says where it
            belongs.
          </li>
          <li>
            <strong>Correct dilution.</strong> A concentrate that is over-diluted does not disinfect. Under-diluted, it
            wastes money and can damage surfaces. We publish the ratio for each use and service the dosing equipment
            that measures it.
          </li>
          <li>
            <strong>Correct zone.</strong> Facilities colour-code their cleaning so that washroom equipment never reaches
            a kitchen: red for sanitary areas, blue for general surfaces, green for food preparation, yellow for
            clinical areas. Our products carry the same zones.
          </li>
          <li>
            <strong>Correct contact time.</strong> Disinfectants need to stay wet on the surface for a set time to work.
            Wiping straight away cleans, but it does not disinfect. We state the contact time so that it can be built
            into the routine.
          </li>
        </ul>

        <h2>Three service lines</h2>
        <p>The chemical is half of the result. The other half is the person, the dosing equipment and the routine.</p>
        <ul>
          {site.services.map((svc) => (
            <li key={svc.slug}>
              <strong>{svc.name}.</strong> {svc.detail}
            </li>
          ))}
        </ul>
        <p>
          <Link href="/services">Read more about support services</Link>
        </p>

        <h2>Who we work with</h2>
        <p>
          Our customers include hospitality, healthcare, foodservice, education, industrial and agricultural
          organisations, gaming and recreation venues, country clubs and maintenance contractors. If your site has a
          kitchen, a washroom, a laundry or a ward, we can help.
        </p>

        <h2>How to buy</h2>
        <ul>
          <li>
            <strong>Order online.</strong> Browse the <Link href="/products">product range</Link>, choose a pack size and
            pay by M-Pesa or card, with delivery to your site or collection from the office. See{" "}
            <Link href="/delivery-and-returns">delivery and returns</Link> for how it works.
          </li>
          <li>
            <strong>Ask for a quote.</strong> For bulk orders, a product that is not listed, or a site-wide programme,{" "}
            <Link href="/quote">request a quote</Link> and we will price it for you.
          </li>
          <li>
            <strong>Open a credit account.</strong> Organisations that order regularly can apply to pay on invoice.{" "}
            <Link href="/contact?topic=credit">Ask about a credit account</Link>.
          </li>
        </ul>

        <h2>Contact</h2>
        <p>
          Phone <a href={`tel:${contact.phone.e164}`}>{contact.phone.display}</a>, WhatsApp{" "}
          <a href={`https://wa.me/${contact.whatsapp.e164}`}>{contact.phone.display}</a> or email{" "}
          <a href={`mailto:${contact.email.address}`}>{contact.email.address}</a>.
        </p>
        <address className="not-italic">
          {contact.address.lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
          <span className="mt-2 block">{contact.address.poBox}</span>
        </address>
      </div>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/contact">Send us a message</ButtonLink>
        <ButtonLink href="/products" variant="secondary">
          Browse products
        </ButtonLink>
      </div>
    </div>
  );
}
