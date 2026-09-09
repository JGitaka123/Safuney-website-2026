/**
 * Whether this deployment may be indexed.
 *
 * The interim site lives on a `*.vercel.app` address and must stay out of search results until the
 * real domain is cut over (ADR 0002). Preview deployments must never be indexed at all, whatever the
 * setting says. `SITE_INDEXABLE=1` on the production deployment is the switch the PO flips at
 * cut-over, and it is deliberately a decision someone makes rather than something that happens on its
 * own the moment a domain is attached.
 */
import { config } from "@/lib/env";

export function isIndexable(): boolean {
  if (!config.isProduction) return false;
  if (process.env["SITE_INDEXABLE"] !== "1") return false;
  // A production deployment still on the preview host is not the live site.
  return !new URL(config.siteUrl).hostname.endsWith(".vercel.app");
}
