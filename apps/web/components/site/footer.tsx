import Link from "next/link";
import { site } from "@/config/site";
import { getSetting } from "@/lib/settings";
import { telHref, whatsappHref } from "@/lib/contact";
import { btn } from "@/components/marketing/buttons";
import { Icon } from "@/components/marketing/icons";
import { LanguageSwitcher } from "./language-switcher";
import { LogoMark } from "./logo";

const linkClass = "text-white/70 hover:text-white hover:underline underline-offset-[3px]";

const QUICK_LINKS = [
  { href: "/products", label: "All products" },
  { href: "/solutions", label: "Browse by industry" },
  { href: "/quote", label: "Request a quote" },
  { href: "/account/credit", label: "Open a credit account" },
  { href: "/resources/dilution", label: "Dilution calculator" },
  { href: "/resources/safety-data-sheets", label: "Safety data sheets" },
  { href: "/resources/colour-coding", label: "Colour-coding guide" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About Safuney" },
  { href: "/contact", label: "Contact" },
];

const SITE_TERMS = [
  { href: "/delivery-and-returns", label: "Delivery and returns" },
  { href: "/terms", label: "Terms of sale" },
  { href: "/privacy", label: "Privacy" },
];

/** Where the reps are and where delivery is quoted to (growth strategy, delivery zones in the seed). */
const WHERE_WE_DELIVER = ["Nairobi", "Kiambu and Thika", "Mombasa and the Coast", "Nakuru", "Kisumu and Western", "Other counties, quoted"];

const PAYMENTS = ["M-Pesa", "Visa", "Mastercard", "Cash on delivery", "Invoice"];

/** Alliance Chemical's footer layout — brand row, link columns, contact, payments — in Safuney's charcoal. */
export async function SiteFooter() {
  const { contact } = site;
  const [kraPin, vatNumber] = await Promise.all([getSetting("company.kraPin"), getSetting("company.vatNumber")]);
  return (
    <footer className="on-dark bg-charcoal text-white/75">
      <div className="mx-auto max-w-page px-5 md:px-6">
        <div className="flex flex-col gap-6 border-b border-white/10 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-surface p-1.5">
                <LogoMark className="size-8" />
              </span>
              <span className="text-h3 text-white">{site.legalName}</span>
            </p>
            <p className="mt-2 text-small italic text-brand-lime">{site.strapline}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/quote" className={`${btn.cta} ${btn.sm}`}>
              Request a quote
            </Link>
            <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={`${btn.ghost} ${btn.sm}`}>
              <Icon name="whatsapp" className="size-4 text-whatsapp" />
              WhatsApp us
            </a>
          </div>
        </div>

        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <nav aria-label="Quick links">
            <p className="text-h4 text-white">Quick links</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-small">
              {QUICK_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Products">
            <p className="text-h4 text-white">Products</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-small">
              {site.productAreas.map((area) => (
                <li key={area.slug}>
                  <Link href={`/products/${area.slug}`} className={linkClass}>
                    {area.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-h4 text-white">Where we deliver</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-small">
              {WHERE_WE_DELIVER.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <nav aria-label="Site terms" className="mt-8">
              <p className="text-h4 text-white">Site terms</p>
              <ul className="mt-4 flex flex-col gap-2.5 text-small">
                {SITE_TERMS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div>
            <p className="text-h4 text-white">Contact</p>
            <address className="mt-4 text-small not-italic">
              <span className="block font-medium text-white">{site.legalName}</span>
              {contact.address.lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              <span className="mt-1 block">{contact.address.poBox}</span>
            </address>
            <ul className="mt-4 flex flex-col gap-2.5 text-small">
              {[contact.phone, ...contact.alternatePhones].map((line) => (
                <li key={line.e164}>
                  <a href={line.e164 === contact.phone.e164 ? telHref : `tel:${line.e164}`} className={`${linkClass} inline-flex items-center gap-2`}>
                    <Icon name="phone" className="size-4" />
                    {line.display}
                  </a>
                </li>
              ))}
              <li>
                <a href={`mailto:${contact.email.address}`} className={`${linkClass} inline-flex items-center gap-2`}>
                  <Icon name="mail" className="size-4" />
                  {contact.email.address}
                </a>
              </li>
            </ul>
            <div className="mt-6">
              <LanguageSwitcher tone="dark" />
            </div>
          </div>
        </div>

        {/* Bottom padding clears the phone contact bar (ContactDock) on small screens. */}
        <div className="flex flex-col gap-4 border-t border-white/10 pb-24 pt-6 text-caption md:flex-row md:items-center md:justify-between md:pb-6">
          <p>
            © {new Date().getFullYear()} {site.legalName}. All rights reserved.
            {kraPin ? <span className="ml-2">KRA PIN {kraPin}</span> : null}
            {vatNumber ? <span className="ml-2">VAT {vatNumber}</span> : null}
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Ways to pay">
            {PAYMENTS.map((p) => (
              <li key={p} className="rounded-chip border border-white/20 px-2.5 py-1 text-white/80">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
