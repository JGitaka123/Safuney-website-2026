# 0002 — The interim *.vercel.app site is not indexable

**Status:** accepted · **Date:** 2026-09-09

## Decision
Until `safuney.com` is cut over (Phase 9), every response carries `X-Robots-Tag: noindex, nofollow`,
the page `<meta name="robots">` says the same, and `robots.txt` disallows everything.

## Why
The live safuney.com still holds the search rankings. A second, indexable copy of the same business on a
`vercel.app` subdomain would compete with it and could be treated as duplicate content.

## Consequences
- The Phase 9 launch runbook must remove all three blocks and submit the sitemap.
- Lighthouse SEO audits on previews will report "page is blocked from indexing"; the Lighthouse CI config
  in Phase 1 must ignore that one audit until cut-over.

## Update, 2026-09-09 (Phase 7)
The block is no longer a hard-coded `disallow: /`. `apps/web/lib/seo/indexing.ts` now gates indexing on
three conditions, all of which must hold: the deployment is production, `SITE_INDEXABLE=1` is set on it,
and the site URL is not a `*.vercel.app` host. A preview is never indexable whatever the flag says, and
a production deployment still on the preview host is not the live site. Tests cover each case.

At cut-over the PO sets `SITE_INDEXABLE=1` on production, which then also turns on the sitemap (empty
until that point — the sitemap of a blocked site is an inventory leak, not an aid) and switches robots
to a real policy that still keeps crawlers out of `/account`, `/admin`, `/api/`, `/cart`, `/checkout`,
`/orders/`, `/quotes/`, `/sales`, `/sign-in` and `/warehouse`.
