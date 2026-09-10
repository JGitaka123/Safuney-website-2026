import Link from "next/link";
import { site } from "@/config/site";
import { isFeatureEnabled } from "@/lib/settings";
import { MobileSearch } from "@/components/search/mobile-search";
import { SearchBox } from "@/components/search/search-box";
import { btn } from "@/components/marketing/buttons";
import { AccountLink } from "./account-link";
import { CartLink } from "./cart-link";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { UtilityBar } from "./utility-bar";

/**
 * Three tiers, which is how every serious trade-supply site in this category is built:
 *
 * - **Utility bar** — the claims a buyer checks first, and who to call. Scrolls away.
 * - **Masthead** — logo, search, account, cart and the one green button: Get a quote. Search gets the
 *   width because in a catalogue this deep it is the navigation for anyone who knows what they want.
 * - **Nav** — the sections.
 *
 * Masthead and nav stick together; the utility bar does not, so the sticky part stays under 110 px.
 */
export async function SiteHeader() {
  const shop = await isFeatureEnabled("shop.enabled");
  return (
    <>
      <UtilityBar />
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-page items-center gap-4 px-5 md:h-[4.25rem] md:gap-6 md:px-6">
          <Logo />

          <div className="hidden min-w-0 flex-1 md:block">
            <SearchBox />
          </div>

          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <AccountLink />
            {shop ? <CartLink /> : null}
            <Link href="/quote" className={`${btn.cta} min-h-11 px-5`}>
              Get a quote
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-1 md:hidden">
            <MobileSearch />
            {shop ? <AccountLink /> : null}
            {shop ? <CartLink /> : null}
            <MobileNav />
          </div>
        </div>

        <nav aria-label="Primary" className="hidden border-t border-line md:block">
          <div className="mx-auto max-w-page px-6">
            <ul className="flex items-center gap-7">
              {site.nav.primary.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center border-b-2 border-transparent py-1 text-body font-medium text-ink hover:border-cta"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="ml-auto">
                <Link
                  href="/resources"
                  className="inline-flex min-h-11 items-center border-b-2 border-transparent py-1 text-small text-ink-muted hover:border-cta hover:text-ink"
                >
                  Guides and safety data
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </header>
    </>
  );
}
