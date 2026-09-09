import { site } from "@/config/site";

const { contact } = site;

export default function HoldingPage() {
  return (
    <>
      <a
        href="#contact"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-steel focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to contact details
      </a>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <p className="text-lg font-semibold tracking-tight text-steel-deep">{site.legalName}</p>
          <a
            href={`tel:${contact.phone.e164}`}
            className="rounded-md bg-steel px-3 py-2 text-sm font-medium text-white hover:bg-steel-deep"
          >
            <span className="sm:hidden">Call us</span>
            <span className="hidden sm:inline">Call {contact.phone.display}</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
        <section aria-labelledby="intro" className="max-w-2xl">
          <p className="mb-3 text-sm font-medium text-steel">New website and online shop in progress</p>
          <h1 id="intro" className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Professional cleaning and hygiene solutions for institutional, hospitality, industrial and
            commercial customers in Kenya.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            Safuney supplies branded cleaning chemicals, hygiene consumables and the support services that
            keep them working: staff training, equipment service and managed housekeeping. We are building a
            new site with a full catalogue and online ordering. Until it launches, order and ask questions by
            phone or email.
          </p>
        </section>

        <section aria-labelledby="products" className="mt-14">
          <h2 id="products" className="text-xl font-semibold tracking-tight">
            What we supply
          </h2>
          <ul className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {site.productAreas.map((area) => (
              <li key={area.name} className="border-l-4 border-steel pl-4">
                <h3 className="font-medium">{area.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{area.blurb}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="services" className="mt-14">
          <h2 id="services" className="text-xl font-semibold tracking-tight">
            Support services
          </h2>
          <ul className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-3">
            {site.services.map((svc) => (
              <li key={svc.name}>
                <h3 className="font-medium">{svc.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{svc.blurb}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="industries" className="mt-14">
          <h2 id="industries" className="text-xl font-semibold tracking-tight">
            Who we serve
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {site.industries.map((name) => (
              <li key={name} className="rounded-full border border-line bg-white px-3 py-1 text-sm">
                {name}
              </li>
            ))}
          </ul>
        </section>

        <section id="contact" aria-labelledby="contact-heading" className="mt-14 rounded-lg bg-white p-6 ring-1 ring-line sm:p-8">
          <h2 id="contact-heading" className="text-xl font-semibold tracking-tight">
            Contact Safuney
          </h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-ink-muted">Phone</dt>
              <dd className="mt-1 font-medium">
                <a href={`tel:${contact.phone.e164}`} className="text-steel-deep underline-offset-4 hover:underline">
                  {contact.phone.display}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Email</dt>
              <dd className="mt-1 font-medium">
                <a href={`mailto:${contact.email.address}`} className="text-steel-deep underline-offset-4 hover:underline">
                  {contact.email.address}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Office</dt>
              <dd className="mt-1">
                {contact.address.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
                <span className="mt-1 block text-sm text-ink-muted">{contact.address.poBox}</span>
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="mt-10 border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-6 text-sm text-ink-muted sm:px-8">
          © {new Date().getFullYear()} {site.legalName}. All rights reserved.
        </div>
      </footer>
    </>
  );
}
