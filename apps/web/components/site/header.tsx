import Link from "next/link";
import { site } from "@/config/site";
import { isFeatureEnabled } from "@/lib/settings";
import { MobileSearch } from "@/components/search/mobile-search";
import { SearchBox } from "@/components/search/search-box";
import { AccountLink } from "./account-link";
import { CartLink } from "./cart-link";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { UtilityBar } from "./utility-bar";

/**
 * Three tiers, which is how every serious trade-supply site in this category is built and why the old
 * single row broke: eleven controls in one line pushed "Sign in" behind the search box at 1280 px, and
 * it carried both a live AccountLink and a static Account button doing the same job.
 *
 * - **Utility bar** — delivery promise, who to call, account. The questions asked before the catalogue.
 * - **Masthead** — logo, search, cart, quote. Search gets real width here because in a catalogue this
 *   deep, search is the navigation for anyone who knows what they want.
 * - **Nav** — the sections. Sticky on its own, so the search and the phone number scroll away but the
 *   way around the site does not.
 */
export async function SiteHeader() {
  const shop = await isFeatureEnabled("shop.enabled");
  return (
    <header className="sticky top-0 z-30 bg-surface">
      <UtilityBar />

      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-page items-center gap-4 px-5 md:h-20 md:gap-8 md:px-6">
          <Logo />

          <div className="hidden min-w-0 flex-1 md:block">
            <SearchBox />
          </div>

          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <AccountLink />
            {shop ? <CartLink /> : null}
            <Link
              href="/quote"
              className="inline-flex min-h-11 items-center rounded-button bg-ink px-4 text-button text-white hover:bg-accent-deep"
            >
              Request a quote
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-1 md:hidden">
            <MobileSearch />
            {shop ? <AccountLink /> : null}
            {shop ? <CartLink /> : null}
            <MobileNav />
          </div>
        </div>
      </div>

      <nav aria-label="Primary" className="hidden border-b border-line bg-surface md:block">
        <div className="mx-auto max-w-page px-6">
          <ul className="flex items-center gap-7">
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
            <li className="ml-auto">
              <Link
                href="/resources"
                className="inline-flex min-h-11 items-center border-b-2 border-transparent py-1 text-body text-ink-muted hover:border-accent hover:text-ink"
              >
                Guides and safety data
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
