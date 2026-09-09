import Link from "next/link";
import { site } from "@/config/site";
import { isFeatureEnabled } from "@/lib/settings";
import { MobileSearch } from "@/components/search/mobile-search";
import { SearchBox } from "@/components/search/search-box";
import { CartLink } from "./cart-link";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const shop = await isFeatureEnabled("shop.enabled");
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-page items-center justify-between gap-4 px-5 md:h-16 md:px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-6">
            {site.nav.primary.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center border-b-2 border-transparent py-1 text-body text-ink hover:border-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden md:block min-w-0 flex-1 max-w-sm">
          <SearchBox />
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {shop ? <CartLink /> : null}
          <Link href="/contact?topic=quote" className="inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep">
            Request a quote
          </Link>
          <a href={`tel:${site.contact.phone.e164}`} className="inline-flex min-h-11 items-center rounded-button bg-ink px-4 text-button text-white hover:bg-accent-deep">
            Call {site.contact.phone.display}
          </a>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <MobileSearch />
          {shop ? <CartLink /> : null}
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
