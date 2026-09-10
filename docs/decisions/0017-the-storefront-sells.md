# 0017 — The storefront sells: a catalogue that is never empty, enquiries that never dead-end, and a sales-first look

**Status:** accepted · **Date:** 2026-09-10 · **Amends** design plan §5 (motion), §7.2 (radius values), §10
(the bans on statistics, eyebrows and hover lift) and ADR 0011 (for the lead offer only)

## Context
The directors' review of the live site: it "looks very wordy for one aimed at selling to the market". It
read like its own specification — paragraphs explaining colour-coding, "every product page *will* show",
a text ledger for the range, and no picture of a product below the fold.

Checking production turned up three harder problems behind the words:

- **The shop window was empty.** Production has one environment variable, `NEXT_PUBLIC_SITE_URL`. With no
  `DATABASE_URL`, every category page said "Products in this category are being published" and every
  product URL returned 404, although the 76-product catalogue (ADR 0016) was sitting in the repository.
- **Every enquiry failed.** With neither a database nor `RESEND_API_KEY`, the contact form answered "We
  could not send this right now" and the quote form "Quotes are not available online right now".
- **Nothing asked for the sale.** No offer, no WhatsApp in reach on a phone, no proof, no numbers.

The Business Growth Strategy v2 (2 September 2026) sets the site's job: feed a new-account engine of site
surveys and trials, make WhatsApp click-to-chat obvious, carry the eTIMS line, show named clients with
permission, and stop being "invisible outside its own website".

## Decision

**1. The catalogue snapshot.** `scripts/catalogue-snapshot.mjs` compiles the company's own catalogue —
`catalogue-seed.csv`, the pack shots in `catalogue-images.json`, and the zones and dosing now moved from
`seed.ts` into `catalogue-meta.json` — into `apps/web/lib/catalogue/snapshot.json`. `lib/catalogue/static.ts`
serves it in the exact shapes the database queries return. `catalogueSource()` decides, per request, which
one the shop window reads: the database once it holds a published product, the snapshot until then (no
`DATABASE_URL`, not seeded, or unreachable).

The switch is all-or-nothing on purpose: falling back product by product would resurrect anything the PO
withdrew in the admin console. Snapshot packs are all price on application, so they get a quote button and
the cart refuses them server-side exactly as before; non-negotiable #1 is untouched. The snapshot's pack
labels and SKUs follow `seed.ts`, and a unit test fails if the snapshot drifts from the catalogue files
(`pnpm guard:catalogue`, also in `pnpm ci`).

**2. Enquiries never dead-end.** `services.leads()` is true when a lead can be stored or emailed. When it
is false, the short quote form composes the request as a WhatsApp message instead of submitting to a
server that can only apologise, and the contact and quote pages use it in place of their full forms. A
contact dock — Call, WhatsApp and Get a quote across the bottom of a phone, one WhatsApp button on a
desktop — is on every public page.

**3. A sales-first look.** Kept: the palette, the zone discipline (zone colours only ever mean zones),
Plex, the accessibility floor, no placeholder copy. Changed:

| Was | Now |
| --- | --- |
| No statistics | Numbers allowed when they are live counts (products, ranges) or standing commitments (one working day) |
| No eyebrows | One short eyebrow per storefront section, sentence case in the source, set in capitals |
| Nothing lifts, one shadow | Cards lift 2 px with `shadow-lift` on hover; `shadow-card` at rest |
| Radius 0 / 2 / 4 | Cards 12 px, buttons 8 px, chips and inputs 6 px |
| One accent | The brand green `#41AD49` is added for the one action we most want taken — get a price — always with ink text (5.78:1), never white |
| Headline on ground | A night-steel hero (`bg-hero`: `#0A1822` with brand-blue and brand-green glows) with the real pack shots on a white stage |

**4. Copy rules.** One headline and at most one sentence per block. Every claim traces to a source: the
catalogue (products, ranges, dosing), the growth strategy (the plant in Ruai, the three sales
territories, eTIMS compliance), or a commitment the site already made (a priced quote within one working
day). The unconfirmed delivery promise with day counts stays out of the header until `poConfirmed`.

**5. Commercial switches in `config/site.ts`.** `offer` — the free site survey with a two-week trial,
from Pillar 2 of the strategy — is on, with `poConfirmed: false`, because it is the directors' own plan
and the site is not yet public; `enabled: false` removes every mention. `clients` is empty and renders
nothing until customers have agreed in writing to be named.

## Consequences
- The real range is visible, searchable and quotable on production today, before any database exists.
- To take orders and store leads, production still needs the database (then `pnpm --filter @safuney/db seed`)
  and `RESEND_API_KEY`; the site switches to them by itself once they are there.
- `ZoneBar`, `TrustBar` and `HeroPacks` are gone; the zones are chips, the trust claims are in the utility
  bar and the hero.

## Second pass (same day): benchmarked against Alliance Chemical and Five Star Chemicals
The directors found the first pass still too wordy and named two benchmarks. Both let products and
names carry the page: Alliance lists "Sulfuric, Hydrochloric, Nitric" under Acids and runs a 20-product
grid with name, sizes and price; Five Star's tiles carry a title and nothing else. So:

- The home page lost every section lead paragraph. Its blocks are now a search-led hero with the six
  products people ask for by name, a six-item fact row, range tiles that list the first product names
  instead of describing the range, a 12-product grid, the range photograph with the 5 L → 505 L numbers,
  three ways to buy, name-only industry tiles, the offer and form, and a collapsed FAQ.
- Product cards in grids show picture, name, pack sizes and price — no description. The product page
  keeps the words.
- Range blurbs in `config/site.ts` are one list-like line each; service cards use the short blurb.
- Safuney's own general photographs, lifted from the catalogue PDF (the five-pack line-up, a commercial
  laundry, a warewashing machine, a cleaning kit), are in `public/brand/`. Photographs from the
  benchmark sites are not used: they are those companies' copyright and brand.
