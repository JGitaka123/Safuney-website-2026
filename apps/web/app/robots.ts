import type { MetadataRoute } from "next";
import { config } from "@/lib/env";
import { isIndexable } from "@/lib/seo/indexing";

/**
 * Blocks every crawler until the site is genuinely live on its own domain (ADR 0002). At cut-over the
 * PO sets `SITE_INDEXABLE=1` on production and this becomes a real policy — one that still keeps
 * crawlers out of the account, checkout, staff and API paths, none of which have anything to index and
 * all of which cost a request to render.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/api/", "/cart", "/checkout", "/orders/", "/quotes/", "/sales", "/sign-in", "/warehouse"],
    },
    sitemap: `${config.siteUrl}/sitemap.xml`,
    host: config.siteUrl,
  };
}
