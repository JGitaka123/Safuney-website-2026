# 0016 — The catalogue is the source of record for the brand and the range

**Status:** accepted · **Date:** 2026-09-10 · **Supersedes** the harvested catalogue seed, the interim
palette in design plan §2.1, the drawn logo mark (ADR 0015 stands for products with no photograph)

## Context
Everything about Safuney on this site until now was inferred. The palette was a teal chosen to suit the
type; the logo was a droplet drawn as an interim; the categories and products came from search-engine
snippets of the old site, because the live site could not be fetched from the build environment; the
contact details carried `poConfirmed: false`.

The PO then supplied `PRODUCT CATALOGUE JULY 2024` — 16 pages, the company's own document. It contains
the logo, the colours, the strapline, nine product sections, seventy-six products with pack sizes and
dosing, a photograph of nearly every one, the industries served, and the address and phone numbers.

## Decision
The catalogue is the source of record for everything it states. Specifically:

**Colours.** `brand-blue` `#408BEF` and `brand-green` `#41AD49` are sampled from the cover's own
headings; `brand-lime` `#86D636` and the mark's blue `#3E8EFF` from the logo bitmap. None of them can
carry text — 3.41:1, 2.88:1 and 1.80:1 against white — so they are display colours, and the interactive
`accent` is the same blue hue taken down to `#0E50A8` (7.69:1). The teal is gone.

**Logo.** The lock-up ships as the catalogue's own artwork, trimmed and de-speckled, at
`public/brand/safuney-logo.png` (275 × 84). It is the raster and not a redraw because the "Clean, safer,
healthier" script in it cannot be reproduced by hand. The **mark** alone is redrawn as vector
(`public/brand/safuney-mark.svg`, `app/icon.svg`) because a 317 px bitmap is useless as a 512 px
installed-app icon. Geometry was traced from the bitmap; the three files must change together.

**Catalogue.** `docs/discovery/catalogue-seed.csv` is rewritten from the document: nine categories in
the catalogue's own order, 76 products, 102 variants, with pack sizes, dosing and the catalogue's own
wording. Nothing in it is a guess. Where the catalogue does not state a pack size (17 chemicals and the
21 equipment lines), the row carries no pack rather than an invented one, and PO question 13 asks for it.

**Photography.** Each product carries its own pack shot, cut out of the PDF by
`scripts/extract-catalogue-images.mjs` and committed to `apps/web/public/products`. The catalogue
embeds them as JPEG plus a soft mask, so they come out as true cut-outs on transparency rather than as
photographs of a white rectangle. ADR 0015's drawn `PackShot` stays as the fallback for a product with
no photograph — it is still what fills the slot when `images[0]` is missing.

## What we deliberately did not take from the catalogue

**Hazard classes.** The catalogue names caustics, acids, chlorine donors, peroxides and an alcohol
sanitiser, and it would be easy to classify them from the chemistry. We did not. A hazard mark on a
product page is a safety claim, and the only defensible source for it is each product's own safety data
sheet. Every product seeds `hazardClass: NONE` and PO question 14 asks for the SDS set.

**Prices.** The catalogue has none. This is the one thing the document cannot supply and the business
must.

## Price on application
Because prices are missing, seeding the catalogue with `needsPoReview: true` would have hidden the
entire real range behind a review flag — the opposite of what supplying the catalogue was meant to
achieve. So the two questions are separated:

- **Is the product real and publishable?** Yes: the copy is the company's own published copy. So
  catalogue rows seed `needsPoReview: false` and are listed, searchable and photographed.
- **Can it be bought online?** Only if it has a price. A variant at `priceMinorUnits = 0` is *price on
  application*: the page says "Price on request" and offers a quote, and `CartService` refuses it with
  a `POA` error.

The refusal is server-side, in the same place that recomputes every total, not in the UI. Non-negotiable
#1 is unchanged: the server is still the price authority, and a crafted request cannot buy an unpriced
20 L drum for nothing. Two tests in `adversarial.test.ts` fail if that guard is removed.

## Consequences
- Category slugs changed (`foodservice` → `warewashing`, and `healthcare`, `laboratory`, `industrial`
  and `agricultural` are gone — the catalogue has no products in them). Solutions pages, the planner,
  the search fallback and the e2e specs were moved with them. No public URLs were live, so nothing
  needed a redirect.
- The planner's "every task points at a category the shop has" test now derives its set from
  `site.productAreas` instead of restating it, which is how it went stale last time.
- A new solutions page exists for food and beverage processing, because the catalogue has a whole
  section of process chemistry the site had nowhere to put.
- `sharp` is now a root devDependency, used only by the extraction script.
