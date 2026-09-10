import Link from "next/link";
import { site } from "@/config/site";
import { getSetting } from "@/lib/settings";
import { whatsappHref } from "@/lib/contact";
import { btn } from "@/components/marketing/buttons";
import { Icon } from "@/components/marketing/icons";
import { LanguageSwitcher } from "./language-switcher";
import { LogoMark } from "./logo";

const linkClass = "text-white/75 hover:text-white hover:underline underline-offset-[3px]";

export async function SiteFooter() {
  const { contact } = site;
  const [kraPin, vatNumber] = await Promise.all([getSetting("company.kraPin"), getSetting("company.vatNumber")]);
  return (
    <footer className="on-dark border-t border-white/10 bg-night text-white/75">
      <div className="mx-auto grid max-w-page gap-10 px-5 py-14 md:grid-cols-12 md:px-6 md:py-16">
        <div className="md:col-span-4">
          <p className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-surface p-1.5">
              <LogoMark className="size-8" />
            </span>
            <span className="text-h4 text-white">{site.legalName}</span>
          </p>
          <p className="mt-3 text-small italic text-brand-lime">{site.strapline}</p>
          <p className="mt-4 max-w-sm text-small">
            Professional cleaning and hygiene chemicals, blended in {site.company.plant}, with the dosing, training and service that make them
            work.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/quote" className={`${btn.cta} min-h-11 px-5`}>
              Get a quote
            </Link>
            <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={`${btn.ghost} min-h-11 px-5`}>
              <Icon name="whatsapp" className="size-4 text-whatsapp" />
              WhatsApp
            </a>
          </div>
          {/* Up here rather than in the last line of the page, where the phone contact bar sits over it. */}
          <div className="mt-6">
            <LanguageSwitcher tone="dark" />
          </div>
        </div>

        <nav aria-label="Products" className="md:col-span-3">
          <p className="text-label text-white">Products</p>
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

        <nav aria-label="Help" className="md:col-span-2">
          <p className="text-label text-white">Help</p>
          <ul className="mt-4 flex flex-col gap-2.5 text-small">
            {site.nav.help.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/services" className={linkClass}>
                Support services
              </Link>
            </li>
            <li>
              <Link href="/about" className={linkClass}>
                About Safuney
              </Link>
            </li>
          </ul>
        </nav>

        <div className="md:col-span-3">
          <p className="text-label text-white">Contact</p>
          <ul className="mt-4 flex flex-col gap-2.5 text-small">
            {[contact.phone, ...contact.alternatePhones].map((line) => (
              <li key={line.e164}>
                <a href={`tel:${line.e164}`} className={linkClass}>
                  {line.display}
                </a>
              </li>
            ))}
            <li>
              <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={linkClass}>
                WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${contact.email.address}`} className={linkClass}>
                {contact.email.address}
              </a>
            </li>
          </ul>
          <address className="mt-5 text-small not-italic">
            {contact.address.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            <span className="mt-2 block">{contact.address.poBox}</span>
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        {/* Bottom padding clears the phone contact bar (ContactDock) on small screens. */}
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4 px-5 pb-24 pt-5 text-caption md:px-6 md:pb-5">
          <p>
            © {new Date().getFullYear()} {site.legalName}. All rights reserved.
            {kraPin ? <span className="ml-2">KRA PIN {kraPin}</span> : null}
            {vatNumber ? <span className="ml-2">VAT {vatNumber}</span> : null}
          </p>
          <ul className="flex flex-wrap gap-6">
            {site.nav.legal.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`${linkClass} inline-flex min-h-11 items-center`}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
