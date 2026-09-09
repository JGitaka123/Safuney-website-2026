import { config } from "@/lib/env";
import { site } from "@/config/site";

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.legalName,
    url: config.siteUrl,
    email: site.contact.email.address,
    telephone: site.contact.phone.e164,
    address: { "@type": "PostalAddress", streetAddress: site.contact.address.lines.slice(0, 2).join(", "), addressLocality: "Nairobi", addressCountry: "KE" },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${config.siteUrl}${it.path}` })),
  };
}

export interface ProductJsonLdInput {
  name: string;
  description: string;
  path: string;
  brand?: string | null;
  images: string[];
  sku: string;
  offers: Array<{ sku: string; priceKes: string; availability: "InStock" | "OutOfStock" | "PreOrder" | "BackOrder"; name: string; url: string }>;
  rating?: { average: number; count: number } | null;
}

export function productJsonLd(p: ProductJsonLdInput): JsonLd {
  const out: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    url: `${config.siteUrl}${p.path}`,
    sku: p.sku,
    image: p.images,
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    offers: p.offers.map((o) => ({
      "@type": "Offer",
      sku: o.sku,
      name: o.name,
      url: o.url,
      priceCurrency: "KES",
      price: o.priceKes,
      availability: `https://schema.org/${o.availability}`,
      seller: { "@type": "Organization", name: site.legalName },
    })),
  };
  if (p.rating) out["aggregateRating"] = { "@type": "AggregateRating", ratingValue: p.rating.average, reviewCount: p.rating.count };
  return out;
}

/**
 * Opening hours as the company keeps them. Not in `site` config because they are a fact about the
 * business the PO confirms, not something harvested — until they do, the page says "call to check"
 * and this returns nothing rather than asserting a guess to Google.
 */
export const OPENING_HOURS: ReadonlyArray<{ days: string[]; opens: string; closes: string }> = [];

/**
 * `LocalBusiness` for the shop's own address and hours.
 *
 * Every field is gated on `poConfirmed`. Structured data is a claim made to search engines and shown
 * as fact in results; asserting an address or a phone number nobody has confirmed is worse than
 * asserting nothing, because a customer drives to it. Returns null when there is nothing confirmed to
 * say, and the caller renders no script tag at all.
 */
export function localBusinessJsonLd(extra: { kraPin?: string; vatNumber?: string } = {}): JsonLd | null {
  const { address, phone, email } = site.contact;
  const out: JsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${config.siteUrl}#business`,
    name: site.legalName,
    url: config.siteUrl,
    description: site.tagline,
    currenciesAccepted: "KES",
    paymentAccepted: "M-Pesa, Card, Cash on delivery, Invoice",
    areaServed: { "@type": "Country", name: "Kenya" },
  };
  if (address.poConfirmed) {
    out["address"] = { "@type": "PostalAddress", streetAddress: address.lines.slice(0, 2).join(", "), addressLocality: "Nairobi", addressCountry: "KE" };
  }
  if (phone.poConfirmed) out["telephone"] = phone.e164;
  if (email.poConfirmed) out["email"] = email.address;
  if (OPENING_HOURS.length > 0) {
    out["openingHoursSpecification"] = OPENING_HOURS.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.days, opens: h.opens, closes: h.closes }));
  }
  if (extra.kraPin) out["taxID"] = extra.kraPin;
  if (extra.vatNumber) out["vatID"] = extra.vatNumber;
  // Nothing confirmed beyond the name and the URL is not a local business listing; it is noise.
  const asserted = ["address", "telephone", "email", "openingHoursSpecification"].filter((k) => k in out);
  return asserted.length > 0 ? out : null;
}

export function faqJsonLd(faq: Array<{ q: string; a: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** Serialise for a <script type="application/ld+json">; escapes "<" so it can never break out of the tag. */
export function jsonLdString(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
