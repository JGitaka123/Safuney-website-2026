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
