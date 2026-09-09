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
