/**
 * Addresses from the previous safuney.com (a PHP site), so links to it in search results, WhatsApp
 * chats and print keep working after the domain moves here. Crawled from the live site on 2026-10-26:
 * four pages and nine categories, no product pages and no downloads. Every one answers with a
 * permanent redirect, which also tells search engines to carry the old page's ranking over.
 *
 * Relative imports only: next.config.ts loads this file.
 */

/** Plain pages; `products.php` is a route handler (app/products.php/route.ts), since it needs the query. */
export function legacyRedirects() {
  return [
    { source: "/index.php", destination: "/", permanent: true },
    { source: "/about.php", destination: "/about", permanent: true },
    { source: "/services.php", destination: "/services", permanent: true },
    { source: "/contact.php", destination: "/contact", permanent: true },
  ];
}

/**
 * The old site's `products.php?a=<category name>` values, as linked from its own menus (both the
 * capitalised and lower-case spellings appear), mapped to the new category pages.
 */
const LEGACY_CATEGORIES: Record<string, string> = {
  "bactro (biological range)": "bactro",
  "cleaning equipment": "equipment",
  "disinfection and sanitization": "disinfection",
  "personal hygiene": "personal-hygiene",
  "specialty products": "specialty",
  "warewashing systems": "warewashing",
  housekeeping: "housekeeping",
  laundry: "laundry",
};

/**
 * Where an old category link goes. Matched ignoring case, extra spaces and "+" for space (search
 * engines indexed `Disinfection+and+Sanitization` and `specialty+products`). Anything unrecognised
 * goes to the full range rather than a dead end.
 */
export function legacyCategoryPath(category: string | null): string {
  const key = (category ?? "").replace(/\+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const slug = LEGACY_CATEGORIES[key];
  return slug ? `/products/${slug}` : "/products";
}
