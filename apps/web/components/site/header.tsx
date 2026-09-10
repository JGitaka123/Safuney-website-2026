import Link from "next/link";
import { site } from "@/config/site";
import { whatsappHref } from "@/lib/contact";
import { INDUSTRIES } from "@/lib/content/solutions";
import { isFeatureEnabled } from "@/lib/settings";
import { MobileSearch } from "@/components/search/mobile-search";
import { SearchBox } from "@/components/search/search-box";
import { btn } from "@/components/marketing/buttons";
import { Icon } from "@/components/marketing/icons";
import { AccountLink } from "./account-link";
import { CartLink } from "./cart-link";
import { LogoMark } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NavMenu } from "./nav-menu";
import { UtilityBar } from "./utility-bar";

const RESOURCES = [
  { href: "/resources/colour-coding", label: "Colour-coding guide" },
  { href: "/resources/dilution", label: "Dilution calculator" },
  { href: "/resources/safety-data-sheets", label: "Safety data sheets" },
  { href: "/delivery-and-returns", label: "Delivery and returns" },
];

const COMPANY = [
  { href: "/about", label: "About Safuney" },
  { href: "/services", label: "Support services" },
  { href: "/account/credit", label: "Open a credit account" },
  { href: "/contact", label: "Contact" },
];

/**
 * Alliance Chemical's header, in Safuney's colours:
 *
 * - an announcement line (UtilityBar) that scrolls away;
 * - a blue masthead with the white lock-up, the big rounded search, account and cart;
 * - a white nav row with "+" menus on the left and the three buying actions on the right.
 *
 * Masthead and nav stick together. On a phone the masthead alone shows: menu, lock-up, search, cart.
 */
export async function SiteHeader() {
  const shop = await isFeatureEnabled("shop.enabled");
  return (
    <>
      <UtilityBar />
      <header className="sticky top-0 z-30 shadow-[0_1px_0_var(--color-line)]">
        <div className="on-dark bg-accent">
          <div className="mx-auto flex h-16 max-w-page items-center gap-2 px-3 sm:px-5 md:h-[4.5rem] md:gap-8 md:px-6">
            <MobileNav tone="dark" />
            {/* The lock-up may shrink (min-w-0), and the strapline drops out under 400 px, so the masthead
                fits a 320 px phone whatever fallback font the device substitutes for Plex. */}
            <Link href="/" aria-label={`${site.legalName} home`} className="flex min-w-0 items-center gap-2.5 rounded-button">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface p-1 md:size-11">
                <LogoMark className="size-8 md:size-9" />
              </span>
              <span aria-hidden className="min-w-0 leading-none">
                <span className="block truncate text-h4 font-semibold tracking-tight text-white md:text-h3">Safuney</span>
                {/* White at 85%, not the brand lime: lime on this blue is 4.27:1, under AA for small text. */}
                <span className="mt-0.5 hidden truncate text-[11px] italic text-white/85 min-[400px]:block md:text-caption">{site.strapline}</span>
              </span>
            </Link>

            <div className="hidden min-w-0 flex-1 md:block">
              <SearchBox variant="pill" placeholder="Search by product name, code or use, e.g. sanitiser" />
            </div>

            <div className="ml-auto flex items-center md:ml-0">
              <div className="md:hidden">
                <MobileSearch tone="dark" />
              </div>
              <AccountLink tone="dark" className="hidden sm:inline-flex" />
              {shop ? <CartLink tone="dark" /> : null}
            </div>
          </div>
        </div>

        <nav aria-label="Primary" className="hidden bg-surface md:block">
          <div className="mx-auto flex max-w-page items-center gap-8 px-6">
            <NavMenu label="Products" columns={2} items={site.productAreas.map((a) => ({ href: `/products/${a.slug}`, label: a.name }))} footer={{ href: "/products", label: "All products" }} />
            <NavMenu label="Solutions" items={INDUSTRIES.map((i) => ({ href: `/solutions/${i.slug}`, label: i.name }))} footer={{ href: "/solutions", label: "All solutions" }} />
            <NavMenu label="Resources" items={RESOURCES} />
            <NavMenu label="Company" items={COMPANY} />
            <div className="ml-auto flex items-center gap-2 py-2">
              <Link href="/quote" className={`${btn.brand} ${btn.sm}`}>
                Request Quote
              </Link>
              <a href={whatsappHref("Hello Safuney, I would like to order:")} target="_blank" rel="noopener noreferrer" className={`${btn.outline} ${btn.sm} hidden lg:inline-flex`}>
                <Icon name="whatsapp" className="size-4" />
                Order on WhatsApp
              </a>
              <Link href="/resources/safety-data-sheets" className={`${btn.outline} ${btn.sm}`}>
                SDS
              </Link>
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}
