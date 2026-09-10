import Link from "next/link";
import { site } from "@/config/site";
import { LanguageSwitcher } from "./language-switcher";

export function SiteFooter() {
  const { contact } = site;
  return (
    <footer className="mt-24 border-t border-line bg-ground-deep">
      <div className="mx-auto grid max-w-page gap-10 px-5 py-12 md:grid-cols-4 md:px-6">
        <div>
          <p className="text-h4">{site.legalName}</p>
          <address className="mt-3 text-small not-italic text-ink-muted">
            {contact.address.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            <span className="mt-2 block">{contact.address.poBox}</span>
          </address>
        </div>
        <nav aria-label="Products">
          <p className="text-label">Products</p>
          <ul className="mt-3 flex flex-col gap-2 text-small">
            {site.productAreas.map((area) => (
              <li key={area.slug}>
                <Link href={`/products#${area.slug}`} className="text-ink hover:underline underline-offset-[3px]">
                  {area.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Help">
          <p className="text-label">Help</p>
          <ul className="mt-3 flex flex-col gap-2 text-small">
            {site.nav.help.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ink hover:underline underline-offset-[3px]">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/services" className="text-ink hover:underline underline-offset-[3px]">
                Support services
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-ink hover:underline underline-offset-[3px]">
                About Safuney
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="text-label">Contact</p>
          <ul className="mt-3 flex flex-col gap-2 text-small">
            {[contact.phone, ...contact.alternatePhones].map((line) => (
              <li key={line.e164}>
                <a href={`tel:${line.e164}`} className="text-ink hover:underline underline-offset-[3px]">
                  {line.display}
                </a>
              </li>
            ))}
            <li>
              <a href={`https://wa.me/${contact.whatsapp.e164}`} className="text-ink hover:underline underline-offset-[3px]">
                WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${contact.email.address}`} className="text-ink hover:underline underline-offset-[3px]">
                {contact.email.address}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4 px-5 py-5 text-caption text-ink-muted md:px-6">
          <p>© {new Date().getFullYear()} {site.legalName}. All rights reserved.</p>
          <LanguageSwitcher />
          <ul className="flex flex-wrap gap-6">
            {site.nav.legal.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:underline underline-offset-[3px]">
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
