import Link from "next/link";
import { ZoneBand, ButtonLink } from "@safuney/ui";
import { site } from "@/config/site";
import { getCategories, getZoneCounts } from "@/lib/catalogue";
import { getSetting } from "@/lib/settings";
import { localBusinessJsonLd, jsonLdString, organizationJsonLd } from "@/lib/seo/jsonld";
import { ZoneBar } from "@/components/site/zone-bar";
import { TrustStrip } from "@/components/site/trust-strip";
import { INDUSTRIES } from "@/lib/content/solutions";

export default async function HomePage() {
  const [categories, zoneCounts, kraPin, vatNumber] = await Promise.all([getCategories(), getZoneCounts(), getSetting("company.kraPin"), getSetting("company.vatNumber")]);
  const business = localBusinessJsonLd({ kraPin, vatNumber });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(business ? [organizationJsonLd(), business] : [organizationJsonLd()]) }} />
      {/* Hero: headline on ground (plan §4.3). The photograph slot above it is filled once the PO's shoot lands (photography.md). */}
      <section aria-labelledby="hero-heading" className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-page gap-8 px-5 py-12 md:grid-cols-12 md:px-6 md:py-20">
          <div className="md:col-span-7">
            <h1 id="hero-heading" className="max-w-[34rem] text-display">
              Professional cleaning chemicals, supplied with the know-how to use them correctly.
            </h1>
          </div>
          <div className="flex flex-col gap-6 md:col-span-5 md:pt-2">
            <p className="max-w-[30rem] text-body text-ink-muted">
              Concentrates, disinfectants, laundry and hand hygiene for kitchens, wards, washrooms and laundries in Kenya,
              with dilution ratios, contact times and safety data on every product.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/products">Browse products</ButtonLink>
              <ButtonLink href="/quote" variant="secondary">
                Request a quote
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="zones-heading" className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-24">
        <h2 id="zones-heading" className="text-h2">
          Where will you use it?
        </h2>
        <p className="mt-2 max-w-[62ch] text-ink-muted">
          Facilities colour-code their cleaning so that washroom equipment never reaches a kitchen. Products here carry
          the same zones.
        </p>
        <div className="mt-8">
          <ZoneBar counts={zoneCounts} animate />
        </div>
      </section>

      <section aria-labelledby="supply-heading" className="mx-auto max-w-page px-5 md:px-6">
        <h2 id="supply-heading" className="text-h2">
          What we supply
        </h2>
        <ul className="mt-6 grid border-t border-line md:grid-cols-2 md:gap-x-12">
          {categories.map((c) => (
            <li key={c.slug} id={c.slug} className="border-b border-line">
              <Link href={`/products#${c.slug}`} className="group flex gap-5 py-5 hover:bg-surface md:py-6">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-h4 text-ink group-hover:underline group-hover:underline-offset-[3px]">{c.name}</span>
                  <span className="text-small text-ink-muted">{c.blurb}</span>
                  {c.zones.length > 0 ? <ZoneBand zones={c.zones} className="mt-2 max-w-24" /> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dilution-heading" className="mx-auto grid max-w-page gap-8 px-5 py-16 md:grid-cols-2 md:px-6 md:py-24">
        <div>
          <h2 id="dilution-heading" className="text-h2">
            Dilution done right
          </h2>
          <p className="mt-4 max-w-[62ch] text-ink-muted">
            A concentrate that is over-diluted does not disinfect. Under-diluted, it wastes money and can damage surfaces.
            Every product page will show the ratio, the contact time and the zone, and a calculator turns litres of
            solution into the exact amount of product to measure out.
          </p>
          <div className="mt-6">
            <ButtonLink href="/products" variant="secondary">
              See how products are described
            </ButtonLink>
          </div>
        </div>
        <table className="w-full self-start border border-line bg-surface text-small">
          <caption className="sr-only">Example dilution chart</caption>
          <thead>
            <tr className="bg-ground-deep text-left">
              <th scope="col" className="px-4 py-3 font-semibold">Ratio</th>
              <th scope="col" className="px-4 py-3 font-semibold">Use</th>
              <th scope="col" className="px-4 py-3 font-semibold">Contact time</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["1:100", "Food-contact surfaces, then rinse", "1 min"],
              ["1:40", "General surfaces", "5 min"],
              ["1:10", "Heavy soil", "10 min"],
            ].map(([ratio, use, time]) => (
              <tr key={ratio} className="border-t border-line">
                <td className="tnum px-4 py-3 font-medium">{ratio}</td>
                <td className="px-4 py-3">{use}</td>
                <td className="tnum px-4 py-3">{time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="services-heading" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-page gap-10 px-5 py-16 md:grid-cols-3 md:px-6 md:py-20">
          <div className="md:col-span-3">
            <h2 id="services-heading" className="text-h2">
              Support services
            </h2>
          </div>
          {site.services.map((svc) => (
            <div key={svc.slug}>
              <h3 className="text-h4">{svc.name}</h3>
              <p className="mt-2 text-small text-ink-muted">{svc.blurb}</p>
            </div>
          ))}
          <div className="md:col-span-3">
            <ButtonLink href="/services" variant="secondary">
              Ask about services
            </ButtonLink>
          </div>
        </div>
      </section>

      <section aria-labelledby="buy-heading" className="mx-auto grid max-w-page gap-10 px-5 py-16 md:grid-cols-2 md:px-6 md:py-24">
        <div>
          <h2 id="buy-heading" className="text-h2">
            Three ways to buy
          </h2>
          <dl className="mt-6 grid gap-5">
            <div>
              <dt className="text-h4">Order online</dt>
              <dd className="text-small text-ink-muted">Pay with M-Pesa or card. Online ordering opens with the catalogue.</dd>
            </div>
            <div>
              <dt className="text-h4">Request a quote</dt>
              <dd className="text-small text-ink-muted">For bulk volumes, tenders or products not yet listed.</dd>
            </div>
            <div>
              <dt className="text-h4">Open a credit account</dt>
              <dd className="text-small text-ink-muted">Organisations can apply for account terms and buy against a purchase order.</dd>
            </div>
          </dl>
        </div>
        <div>
          <h2 className="text-h2">Who we serve</h2>
          <p className="mt-6 max-w-[62ch] text-ink-muted">{site.industries.join(", ")}.</p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {INDUSTRIES.map((i) => (
              <li key={i.slug}>
                <Link href={`/solutions/${i.slug}`} className="text-accent underline underline-offset-[3px] hover:decoration-2">
                  {i.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6">
            <Link href="/contact" className="text-accent underline underline-offset-[3px] hover:decoration-2">
              Talk to us about your site
            </Link>
          </p>
        </div>
      </section>

      <TrustStrip facts={{ kraPin, vatNumber }} />
    </>
  );
}
