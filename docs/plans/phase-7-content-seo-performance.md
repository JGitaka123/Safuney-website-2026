# Phase 7 plan — content, SEO, performance, trust, Swahili

**Date:** 2026-09-09 · **Status:** planned · Spec: master prompt §8 Phase 7.

## Scope (from the brief)
1. Content architecture: solutions by industry, products by application, resources (dilution charts,
   colour-coding guide, HACCP cleaning schedules, infection-prevention basics, SDS library), about,
   compliance and certifications (**only those the PO confirms**), case studies (**only real,
   PO-approved**), careers, contact.
2. SEO: sitemap, robots, canonical, hreflang (en, sw), JSON-LD (`Organization`, `LocalBusiness`,
   `Product`, `BreadcrumbList`, `FAQPage`), Open Graph images per product, Core Web Vitals monitoring.
3. Trust: physical address, KRA PIN and VAT number, opening hours, WhatsApp line, delivery promise,
   returns policy, payment badges, verified-purchase reviews.
4. Swahili locale (`/sw`) for navigation, checkout and key pages; i18n key-leak guard in CI.
5. Performance: RSC by default, streaming, edge caching with tag-based revalidation on product and
   stock change, image CDN, font subsetting, zero layout shift.

## What already exists
`Organization`, `Product`, `BreadcrumbList` and `FAQPage` JSON-LD (`lib/seo/jsonld.ts`); robots that
blocks everything while the site is interim; self-hosted subset fonts (ADR 0005); the design system's
fixed aspect ratios, which is where zero layout shift comes from; content pages and review moderation
from Phase 6.

## The tension in this phase, and how it is resolved
Two non-negotiables pull against each other here. "No placeholder text ships" (enforced by
`guard:placeholders`) versus a brief that asks for compliance pages, case studies and an SDS library —
none of which we have real content for. **Nothing gets invented.** Each of those is built as a real
page that renders what the database holds and, when it holds nothing, says so plainly in the company's
own voice rather than showing lorem or an invented certificate. A compliance page that says "we have
not published our certifications yet — ask us and we will send them" is honest; one listing ISO
numbers nobody confirmed is a liability.

## Workstreams
### A. SEO plumbing (first, because everything else feeds it)
- `app/sitemap.ts`: static pages, categories, published products, published content pages. Excluded
  while `robots` still blocks (the sitemap of a noindex site is a leak, not an aid).
- Canonical URLs and `alternates.languages` (en, sw) in the root metadata and per page.
- `LocalBusiness` JSON-LD with address, opening hours, phone and geo — gated on `poConfirmed`, so
  nothing unconfirmed is asserted to Google as fact.
- Per-product Open Graph images via the App Router's `opengraph-image` convention, drawn from the
  product's own name, pack and zone rather than a stock photo.
- Web Vitals reporting to an endpoint that writes to `Setting`-adjacent storage, or logs, so LCP is
  measured in the field and not only in CI.

### B. Content architecture
- `/solutions/[industry]` for the six industries in the brief, each assembled from real categories and
  products rather than prose about them.
- `/resources` with the colour-coding guide (already a design primitive), a dilution chart per product
  from `dilutionGuidance`, and the SDS library reading `Document`.
- `/compliance`, `/case-studies`, `/careers` — real pages, honest empty states, editable in the admin
  console so the PO fills them without a deploy.

### C. Trust
A single trust strip component fed by `site` config and the settings the PO sets in `/admin/settings`:
address, KRA PIN and VAT (once set), hours, WhatsApp, delivery promise, returns window, payment marks.
Verified-purchase reviews already carry `verifiedOrderId`; surface that on the product page.

### D. Swahili
Route group `/sw` sharing every server component, with a message catalogue for navigation, checkout,
and the key pages. The i18n key-leak guard already runs in `guard:placeholders`; extend it to fail on a
missing key rather than only a leaked one.

### E. Performance
`revalidateTag` on product and stock change — the admin console already funnels every catalogue
mutation through one seam, so tagging is a handful of lines there rather than scattered everywhere.

## Order of work
1. SEO plumbing and per-product OG images.
2. Solutions and resources.
3. Trust strip and verified reviews.
4. Swahili.
5. Tag-based revalidation and Web Vitals.

## Decisions to record
- ADR: unconfirmed company facts are never asserted in structured data.
- ADR: Swahili as a route group sharing components, not a duplicated tree.
