# Design plan — safuney.com rebuild

**Phase:** 1. **Date:** 2026-09-09. **Status:** proposed, awaiting PO sign-off.
**Inputs:** `apps/web/config/site.ts`, `docs/discovery/*.md`, the interim palette in `apps/web/app/globals.css`
(which this plan replaces).

This document is the single source of truth for colour, type, layout, motion and component behaviour.
Anything not decided here is decided in code review against the principles in §1 and §11.

---

## 1. Brand idea

Safuney sells clinical confidence: a surface is clean because the right product was diluted at the right
ratio, left for the right contact time and used in the right zone — not because it looks shiny. The site
borrows its whole visual vocabulary from that material world: hospital-grade white, brushed stainless steel,
water and surfactant foam, measured dilution, and the industry's colour-coded cleaning zones (red for
washrooms, blue for general low-risk areas, green for kitchens and food prep, yellow for clinical and
isolation), used the way a facilities manager actually uses them — as a system, not as decoration.

What that means in practice:

| Principle | Consequence on the page |
| --- | --- |
| Clean because it was done correctly | Every product page leads with dilution, contact time and zone before it leads with adjectives. |
| The colour system is real | Red / blue / green / yellow are reserved for zones. They are never used for "sale", "new", success or error. |
| One disciplined accent | A single teal for everything interactive. If it is teal you can press it. |
| Stainless, not chrome | Neutrals are cool and matte. No gradients, no glossy highlights, no glassmorphism. |
| Label, not brochure | Information is laid out like a product label or a dosing chart: dense, aligned, tabular numbers, mono for codes. |

---

## 2. Palette

### 2.1 Core colours

| Token | Name | Hex | Role | Contrast |
| --- | --- | --- | --- | --- |
| `ground` | Ward white | `#F4F7F9` | Page background. A cool, matte white — the colour of a washed tiled wall, not a cream. | ink on ground **15.45:1** |
| `surface` | White | `#FFFFFF` | Cards, inputs, product photography backgrounds, table rows. | ink on surface **16.62:1** |
| `ink` | Steel ink | `#10202B` | Body text, headings, primary button fill, icons. Blue-black, like wet steel. | on white **16.62:1** |
| `ink-muted` | Wet steel | `#4A5C68` | Secondary text, captions, labels, placeholders. | on white **6.95:1**, on ground **6.46:1** |
| `line` | Rinse | `#CBD5DB` | 1 px hairlines, table rules, card borders. Decorative only — never carries meaning on its own. | vs white 1.49:1 (non-text, decorative) |
| `accent` | Dilution teal | `#0B5E73` | The one accent: links, primary actions, focus rings, selected states, progress. The colour of a concentrate in a clear dosing bottle. | on white **7.34:1**; white on teal **7.34:1** |

Derived states (not new colours — tints and shades of the six above):

| Token | Hex | Use | Contrast |
| --- | --- | --- | --- |
| `accent-deep` | `#07485A` | Hover/active for teal buttons and links. | on white 10.08:1 |
| `accent-wash` | `#E4EFF2` | Selected filter chip background, table row highlight, "in cart" state. Always paired with `accent` or `ink` text. | ink on wash 14.19:1 |
| `stainless` | `#6F7D87` | Input borders, disabled text, non-decorative icons — anything that must meet the 3:1 UI-component rule. | on white **4.23:1** |
| `ground-deep` | `#E6ECF0` | Footer, checkout summary panel, table header row. | ink on it 13.95:1 |

### 2.2 Zone colours (functional set)

These follow the colour-coded cleaning convention used across hospitality, healthcare and facilities
management. Each zone has a **swatch** (the pure colour, for bands, dots and badge fills), a **text** colour
(what you use when the zone name is written on white) and a **text-on-swatch** colour.

| Zone | Meaning | Swatch | Text on white | Text on swatch | Contrast |
| --- | --- | --- | --- | --- | --- |
| `zone-red` | Washrooms, toilets, sanitary areas | `#B8132A` | `#B8132A` | white | red on white **6.64:1**; white on red **6.64:1**; on ground 6.17:1 |
| `zone-blue` | General low-risk areas — floors, corridors, offices, public areas | `#1747C2` | `#1747C2` | white | blue on white **7.73:1**; white on blue **7.73:1**; on ground 7.18:1 |
| `zone-green` | Kitchens, food preparation, food-contact surfaces | `#137035` | `#137035` | white | green on white **6.18:1**; white on green **6.18:1**; on ground 5.75:1 |
| `zone-yellow` | Clinical, isolation, infection-control areas | `#F2C200` | `#7A5B00` (paired ink) | `#10202B` (ink) | yellow on white 1.68:1 — **never used as text**; paired ink on white **6.32:1**; ink on yellow **9.89:1** |

Rules for the zone set:

1. A zone colour is always accompanied by the zone word. Colour is never the only carrier (WCAG 1.4.1).
2. Zone colours are used *only* for zones: the hero zone bar, filter chips, product badges, the band on
   product cards, the "where to use" row on product pages, and the colour-coding guide. Nothing else.
3. Yellow is a fill, never a text colour on light backgrounds. Its badge is yellow with ink text; its
   name in running text is `#7A5B00`.
4. Products can belong to more than one zone (a general-purpose cleaner-disinfectant is blue and red).
   Laundry, laboratory and personal-hygiene products are outside the zone system and carry no band —
   we do not invent a fifth colour.

### 2.3 Status colours

Error, warning and success must not collide with the zone set, so they are expressed through the core
palette, not through red/green:

| State | Treatment |
| --- | --- |
| Error | Text and 2 px border in `ink`; a filled ink circle with a white "!" icon at the start of the message. The message says what went wrong and how to fix it (§7). |
| Success | Teal (`accent`) text with a tick icon. "Added to cart — view cart" is teal, not green. |
| Warning / attention | `#7A5B00` text on `#FFF5CC` panel (5.77:1) — this is the *yellow-zone ink*, deliberately, because the only warnings on this site are hazard notices (corrosive, oxidiser) and those belong in the same visual register as clinical caution. |

### 2.4 Explicitly rejected

- Cream ground + serif + terracotta: rejected — it reads as a bakery or a boutique, and cream is the
  opposite of hospital-grade white.
- Near-black + acid green: rejected — green is a zone colour here and acid green reads as a start-up.
- Any gradient, including on the hero and on buttons.

---

## 3. Typography

### 3.1 Typefaces

One superfamily, two cuts, both on Google Fonts and self-hosted through `next/font/google`:

| Face | Weights | Role |
| --- | --- | --- |
| **IBM Plex Sans** | 400, 500, 600 | Everything: headings, body, buttons, navigation, prices. Load with `font-feature-settings: "tnum"` on prices, pack sizes, quantities and tables so columns of numbers align. |
| **IBM Plex Mono** | 400, 500 | SKUs, dilution ratios (`1:40`), batch and SDS revision numbers, pack sizes inside data tables, order numbers, M-Pesa transaction codes. |

Why Plex, in the language of the brand: it was drawn as an engineering typeface — squared-off terminals,
even stroke weight, a large x-height, and numerals that sit in a column like a dosing chart. It looks like
the print on a chemical label or an SDS, not like a lifestyle magazine (a serif) and not like every SaaS
dashboard (Inter, Geist). The Mono cut exists in the same drawing, so `SKU SF-0142` beside a product name
looks like a batch stamp on the same label rather than a foreign object. Both cuts are legible at 13 px on
a low-cost Android screen, which is where most Kenyan B2B buyers will read this site.

Fallback stack: `"IBM Plex Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` and
`"IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, monospace`. Use `display: swap` with
`adjustFontFallback` so the swap does not reflow the price column.

### 3.2 Type scale

Base is 16 px on mobile and 17 px on desktop. Every size is a fixed pixel value at the two breakpoints;
between 360 and 1280 px the sizes interpolate with `clamp()`. Line heights are in px. Letter-spacing is
`-0.01em` at 28 px and above, `0` otherwise; nothing is tracked out.

| Token | Mobile 360 px (size / lh) | Desktop 1280 px (size / lh) | Weight | Where |
| --- | --- | --- | --- | --- |
| `display` | 32 / 38 | 52 / 58 | 600 | Home hero headline only |
| `h1` | 28 / 34 | 40 / 46 | 600 | Page titles (category, product, checkout) |
| `h2` | 24 / 30 | 30 / 38 | 600 | Section headings |
| `h3` | 20 / 28 | 22 / 30 | 600 | Sub-sections, product-page panels |
| `h4` | 17 / 24 | 18 / 26 | 600 | Product names in listings, card titles |
| `body` | 16 / 24 | 17 / 27 | 400 | Running text |
| `body-strong` | 16 / 24 | 17 / 27 | 500 | Lead-ins, definition terms |
| `small` | 14 / 21 | 15 / 22 | 400 | Meta, secondary descriptions, table cells |
| `caption` | 13 / 18 | 13 / 18 | 400 | Photo captions, footnotes, VAT line |
| `label` | 13 / 16 | 13 / 16 | 600 | Zone badges, chips, small buttons — sentence case |
| `button` | 16 / 24 | 16 / 24 | 500 | All buttons |
| `price` | 18 / 24 | 20 / 26 | 600, `tnum` | Prices in listings and product pages |
| `price-lg` | 24 / 30 | 28 / 34 | 600, `tnum` | Order total in checkout |
| `mono` | 14 / 20 | 14 / 20 | 400 (Mono) | SKUs, ratios, codes |
| `mono-sm` | 12 / 16 | 12 / 16 | 400 (Mono) | Codes inside tables and badges |

### 3.3 Measure

Body text is capped at `max-width: 62ch` (≈ 610 px at 17 px Plex Sans), which keeps lines under 75
characters on desktop. At 360 px with 20 px side padding the natural measure is ≈ 40 characters. Headings
cap at `28ch`. Tables and product grids are exempt and may use the full container.

Container widths: `max-width: 1200px` for the page, `1040px` for reading pages (About, Resources, Policies).

---

## 4. Layout concept

### 4.1 The zone system as structure

The category tree (`site.productAreas`) stays as the primary taxonomy — it matches how the PO stocks and
how buyers search. The zone system is a **cross-cutting facet** laid over it, and it appears in exactly
five places, always in the same form:

1. **Home zone bar** — four bands under the hero. Tap one to see every product for that zone.
2. **Category filter** — the first filter group on every listing is "Where will you use it?" with the four
   zone chips.
3. **Product card band** — a 6 px band under the photo, split into equal segments when a product is
   multi-zone.
4. **Product page "Use in" row** — badges with the zone word, directly under the title.
5. **Resources → Colour-coded cleaning guide** — the explainer page (Phase 7) that the badges link to.

Everything else (hazard class, pack size, brand, food-contact safe) is a normal filter.

### 4.2 Header and navigation

Mobile: 56 px bar — logo left, search icon, cart with count, menu. Menu opens a full-height sheet listing
Products (with the eight categories and the four zones), Services, Industries, Resources, Account, and a
"Call +254 796 808 822" and "WhatsApp" pair at the bottom.

Desktop: 64 px bar — logo, Products (opens a panel: categories in two columns on the left, zone bar on the
right), Services, Industries, Resources; then search field, "Request a quote", account, cart. Sticky.

### 4.3 Home — 360 px

```
+----------------------------------------+
| Safuney            [search] [cart 0] [=]|
+----------------------------------------+
|                                        |
|   PHOTO: four trigger-spray bottles    |
|   standing on a wet stainless bench,   |
|   labels red / blue / green / yellow,  |
|   full-bleed, 4:5 crop, no overlay     |
|                                        |
+----------------------------------------+
| Professional cleaning chemicals,       |
| supplied with the know-how to use      |
| them correctly.               (display)|
|                                        |
| Concentrates, disinfectants, laundry   |
| and hand hygiene for kitchens, wards,  |
| washrooms and laundries in Kenya.      |
|                                        |
| [ Browse products     ]  (primary)     |
| [ Request a quote     ]  (secondary)   |
+----------------------------------------+
| Where will you use it?            (h2) |
| +----------------------------------+   |
| |##| Washrooms              12 >   |   |  <- red band, 8px
| +----------------------------------+   |
| |##| General areas          18 >   |   |  <- blue
| +----------------------------------+   |
| |##| Kitchen and food prep  22 >   |   |  <- green
| +----------------------------------+   |
| |##| Clinical and isolation  9 >   |   |  <- yellow (ink text)
| +----------------------------------+   |
+----------------------------------------+
| What we supply                    (h2) |
| ---------------------------------------|
| [img] Foodservice and kitchen hygiene  |
|       Detergents, degreasers and ...   |
|       ● ●                     (zones)  |
| ---------------------------------------|
| [img] Disinfection and sanitisation    |
|       QAC and chlorine sanitisers ...  |
|       ● ● ● ●                          |
| ---------------------------------------|
| [img] Laundry                          |
|       Detergents and conditioners ...  |
| ---------------------------------------|
|  ... 5 more rows, same pattern         |
+----------------------------------------+
| Dilution done right               (h2) |
| A concentrate that is over-diluted     |
| does not disinfect; under-diluted it   |
| wastes money and can damage surfaces.  |
| Every product page shows the ratio,    |
| the contact time and the zone.         |
|                                        |
| +----------------------------------+   |
| | 1:40   general cleaning          |   |  <- mono table
| | 1:10   heavy soil                |   |
| | 5 min  contact time              |   |
| +----------------------------------+   |
| [ Open the dilution calculator ]       |
+----------------------------------------+
| Support services                  (h2) |
| Training — staff training that builds  |
| consistent cleaning practice.          |
| Equipment service and repair — ...     |
| Housekeeping services — ...            |
| [ Ask about services ]                 |
+----------------------------------------+
| Three ways to buy                 (h2) |
| Order online — pay with M-Pesa or card |
| Request a quote — bulk or unlisted     |
| Open a credit account — 30-day terms   |
+----------------------------------------+
| Who we serve                      (h2) |
| Hospitality, Healthcare, Foodservice,  |
| Education, Industrial, Agricultural,   |
| Gaming and recreation, Country clubs,  |
| Maintenance contractors                |
+----------------------------------------+
| FOOTER (ground-deep)                   |
| Safuney Limited                        |
| Park View Heights, Mombasa Road        |
| Mezzanine 3, Office A, Nairobi         |
| +254 796 808 822   WhatsApp            |
| info@safuney.com                       |
| Mon–Fri 08:00–17:00 (PO to confirm)    |
| KRA PIN (PO to supply)                 |
| Privacy  Terms of sale  Delivery       |
+----------------------------------------+
```

The hero has no text overlay: the photograph is allowed to be a photograph, and the headline sits on
ground beneath it where contrast is guaranteed. Section dividers are hairlines, not cards.

### 4.4 Home — 1280 px

```
+------------------------------------------------------------------------------------------------------+
| Safuney   Products v   Services   Industries   Resources        [ Search products        ]  Quote  Acct  Cart 0 |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  PHOTO full-bleed, 16:7, the colour-coded lineup on stainless steel, shot from bench height          |
|                                                                                                      |
|                                                                                                      |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  Professional cleaning chemicals, supplied            Concentrates, disinfectants, laundry and       |
|  with the know-how to use them correctly.             hand hygiene for kitchens, wards, washrooms    |
|  (display, 7 cols)                                    and laundries in Kenya. (body, 4 cols)         |
|                                                       [ Browse products ] [ Request a quote ]        |
|                                                                                                      |
+------------------------------------------------------------------------------------------------------+
|  Where will you use it?                                                                              |
|  +----------------------+ +----------------------+ +----------------------+ +----------------------+  |
|  |########## (red)      | |########## (blue)     | |########## (green)    | |########## (yellow)   |  |
|  | Washrooms            | | General areas        | | Kitchen and food prep| | Clinical and isolation| |
|  | 12 products          | | 18 products          | | 22 products          | | 9 products           |  |
|  +----------------------+ +----------------------+ +----------------------+ +----------------------+  |
|  Not sure which zone? Read the colour-coded cleaning guide.                                          |
+------------------------------------------------------------------------------------------------------+
|  What we supply                                                                                      |
|  +---------------------------------------------+  +---------------------------------------------+    |
|  | [img 96px] Foodservice and kitchen hygiene   |  | [img] Disinfection and sanitisation         |    |
|  |            Detergents, degreasers ...  ● ●   |  |       QAC and chlorine ...          ● ● ● ● |    |
|  +---------------------------------------------+  +---------------------------------------------+    |
|  | [img] Laundry                                |  | [img] Housekeeping and janitorial   ● ●     |    |
|  +---------------------------------------------+  +---------------------------------------------+    |
|  | [img] Healthcare and medical equipment  ●    |  | [img] Laboratory                            |    |
|  +---------------------------------------------+  +---------------------------------------------+    |
|  | [img] Specialty products                ● ●  |  | [img] Personal hygiene                      |    |
|  +---------------------------------------------+  +---------------------------------------------+    |
|  (two-column ledger with hairline rows — not a card grid)                                            |
+------------------------------------------------------------------------------------------------------+
|  Dilution done right                              |  +--------------------------------------------+  |
|  A concentrate that is over-diluted does not      |  | Ratio    Use               Contact time    |  |
|  disinfect; under-diluted it wastes money and     |  | 1:40     General cleaning  5 min           |  |
|  can damage surfaces. Every product page shows    |  | 1:10     Heavy soil        10 min          |  |
|  the ratio, the contact time and the zone.        |  | 1:100    Food-contact rinse 1 min          |  |
|  [ Open the dilution calculator ]                 |  +--------------------------------------------+  |
|                                                   |  PHOTO: dosing pump filling a labelled bottle   |
+------------------------------------------------------------------------------------------------------+
|  Support services                   |  Three ways to buy                    |  Who we serve          |
|  Training                            |  Order online (M-Pesa, card)          |  Hospitality           |
|  Equipment service and repair        |  Request a quote                      |  Healthcare ...        |
|  Housekeeping services               |  Open a credit account                |                        |
+------------------------------------------------------------------------------------------------------+
|  FOOTER: 4 columns — Company (address, KRA PIN, hours) | Products (8) | Help (delivery, returns,      |
|  SDS library, dilution guide) | Contact (phone, WhatsApp, email). Legal line below.                   |
+------------------------------------------------------------------------------------------------------+
```

### 4.5 Category page — 360 px

```
+----------------------------------------+
| < Products                             |
| Disinfection and sanitisation     (h1) |
| QAC and chlorine sanitisers, salad and |
| fruit wash, hand sanitiser.            |
+----------------------------------------+
| Where will you use it?                 |
| (● Washrooms)(● General)(● Kitchen)    |
| (● Clinical)             <- chips, wrap|
|                                        |
| [ Filters (2) ]   Sort: Name A–Z  v    |
+----------------------------------------+
| 14 products                            |
| +-----------------+ +-----------------+|
| |                 | |                 ||
| |   PHOTO 1:1     | |   PHOTO 1:1     ||
| |                 | |                 ||
| |####|####        | |####             || <- 6px zone band(s)
| | QAC surface and | | Chlorine        ||
| | food-contact    | | disinfectant    ||
| | sanitiser  (h4) | | and bleach      ||
| | 5 L   20 L      | | 5 L  20 L  25 L || <- pack chips
| | From KES 1,250  | | From KES 890    || <- price, tnum
| | [Add to cart]   | | [Add to cart]   ||
| +-----------------+ +-----------------+|
| +-----------------+ +-----------------+|
| | ...             | | ...             ||
| | Corrosive  (i)  | |                 || <- hazard badge, warning colour
| | [Request quote] | | [Add to cart]   || <- no price → quote
| +-----------------+ +-----------------+|
|              [ Show 12 more ]          |
+----------------------------------------+
```

"Filters (2)" opens a bottom sheet: Zone (chips), Hazard class (checkboxes), Pack size, Brand,
Food-contact safe (switch). Applying closes the sheet and updates the count in place; the URL carries the
state (`?zone=green&hazard=none`) so filtered lists can be shared over WhatsApp.

### 4.6 Category page — 1280 px

```
+------------------------------------------------------------------------------------------------------+
| header                                                                                               |
+------------------------------------------------------------------------------------------------------+
| Products > Disinfection and sanitisation                                                             |
| Disinfection and sanitisation (h1)                        QAC and chlorine sanitisers, salad and     |
|                                                           fruit wash, hand sanitiser. (body, 4 cols) |
+------------------------------------------------------------------------------------------------------+
| +------------------------+  +---------------------------------------------------------------------+  |
| | Where will you use it? |  | 14 products                              Sort: Name A–Z  v          |  |
| | [x] ● Washrooms        |  |                                                                     |  |
| | [ ] ● General areas    |  |  +-------------+ +-------------+ +-------------+ +-------------+   |  |
| | [x] ● Kitchen and food |  |  |  PHOTO 1:1  | |  PHOTO 1:1  | |  PHOTO 1:1  | |  PHOTO 1:1  |   |  |
| | [ ] ● Clinical         |  |  |#####|#####  | |#####        | |             | |###|###|###|##|   |  |
| |                        |  |  | QAC surface | | Chlorine    | | Alcohol hand| | General     |   |  |
| | Hazard class           |  |  | and food-   | | disinfectant| | sanitiser   | | purpose     |   |  |
| | [ ] None               |  |  | contact ... | | and bleach  | | gel         | | cleaner ... |   |  |
| | [ ] Irritant           |  |  | 5 L   20 L  | | 5 L 20 L 25L| | 500 ml  5 L | | 5 L   20 L  |   |  |
| | [ ] Corrosive          |  |  | From KES    | | From KES    | | From KES    | | From KES    |   |  |
| | [ ] Oxidiser           |  |  | 1,250       | | 890         | | 420         | | 1,100       |   |  |
| |                        |  |  |[Add to cart]| |[Add to cart]| |[Add to cart]| |[Add to cart]|   |  |
| | Pack size              |  |  +-------------+ +-------------+ +-------------+ +-------------+   |  |
| | [ ] 500 ml  [ ] 5 L    |  |                                                                     |  |
| | [ ] 20 L    [ ] 25 L   |  |  ... rows of four, 24 px gutter                                     |  |
| |                        |  |                                                                     |  |
| | Brand                  |  |                                                                     |  |
| | (list, PO to confirm)  |  |                                                                     |  |
| |                        |  |                                                                     |  |
| | [ ] Food-contact safe  |  |                                                                     |  |
| | Clear all              |  |                            [ Show 12 more ]                         |  |
| +------------------------+  +---------------------------------------------------------------------+  |
+------------------------------------------------------------------------------------------------------+
```

The product card: photo on `surface` with a 1 px `line` border, radius 0; the 6 px zone band sits flush
under the photo *inside* the border so it reads as the coloured strip on a label; text below the band
sits on `ground` with no border and no shadow. Hover: the photo border darkens to `stainless`; nothing
lifts. Price is the lowest pack price, prefixed "From" only when there is more than one pack.

### 4.7 Product page — 360 px

```
+----------------------------------------+
| < Disinfection and sanitisation        |
+----------------------------------------+
|                                        |
|         PHOTO 1:1 — front label        |
|                                        |
|  o  o  o  o        (front/back/use/scale)|
+----------------------------------------+
| QAC surface and food-contact           |
| sanitiser                         (h1) |
| Brand name (PO)      SF-0142   (mono)  |
| Use in:  [● Kitchen and food prep]     |
|          [● General areas]             |
+----------------------------------------+
| Pack size                              |
| (o) 5 L    KES 1,250.00                |
| ( ) 20 L   KES 4,400.00                |
| VAT 16% included. Excl. price shown    |
| for organisation accounts.  (caption)  |
|                                        |
| Quantity  [ - ]  1  [ + ]              |
| In stock. Delivery in Nairobi 1–2      |
| working days (PO to confirm).          |
+----------------------------------------+
| How to use                        (h2) |
| +----------------------------------+   |
| | Ratio  Use              Contact  |   |
| | 1:100  Food-contact     1 min    |   |
| |        surfaces, rinse           |   |
| | 1:40   General surfaces 5 min    |   |
| +----------------------------------+   |
| Fill the bottle with water first,      |
| then add concentrate.                  |
| [ Work out a dilution ]                |
+----------------------------------------+
| Safety                            (h2) |
| [!] Irritant. Wear gloves and eye      |
|     protection. Do not mix with        |
|     chlorine products.                 |
| Safety data sheet (PDF, 240 KB)        |
| Certificate of analysis (PDF, 90 KB)   |
+----------------------------------------+
| Goes with                         (h2) |
| Trigger spray bottle, 750 ml, green    |
| Dosing pump for 5 L                    |
+----------------------------------------+
| Specifications                    (h2) |
| Active        QAC (benzalkonium ...)   |
| pH (concentrate)  7.5–8.5              |
| Appearance    Clear, colourless        |
| Shelf life    24 months                |
+----------------------------------------+
|                                        |
+========================================+   <- sticky bar, shadow
| KES 1,250.00  5 L      [ Add to cart ] |
+========================================+
```

Sections are stacked, not tabbed; a buyer checking a product for an audit scrolls once and finds
everything. The sticky bar appears once the pack selector scrolls out of view.

### 4.8 Product page — 1280 px

```
+------------------------------------------------------------------------------------------------------+
| header                                                                                               |
+------------------------------------------------------------------------------------------------------+
| Products > Disinfection and sanitisation > QAC surface and food-contact sanitiser                    |
+------------------------------------------------------------------------------------------------------+
| +----------------------------------------------+   +----------------------------------------------+ |
| | [o]                                          |   | QAC surface and food-contact sanitiser (h1)  | |
| | [o]      PHOTO 1:1 — front label             |   | Brand name (PO)        SF-0142 (mono)        | |
| | [o]                                          |   | Use in: [● Kitchen and food prep]            | |
| | [o]                                          |   |         [● General areas]                    | |
| |   thumbnails: front, back, in use, scale     |   |                                              | |
| +----------------------------------------------+   | Pack size                                    | |
| |                                              |   | (o) 5 L     KES 1,250.00                     | |
| | How to use                               (h2)|   | ( ) 20 L    KES 4,400.00                     | |
| | +------------------------------------------+ |   | VAT 16% included.                            | |
| | | Ratio   Use                  Contact time| |   |                                              | |
| | | 1:100   Food-contact surfaces  1 min     | |   | Quantity [ - ] 1 [ + ]                       | |
| | | 1:40    General surfaces       5 min     | |   | [        Add to cart        ]                | |
| | +------------------------------------------+ |   | [ Request a quote for bulk  ]                | |
| | Fill the bottle with water first, then add  |   |                                              | |
| | concentrate. [ Work out a dilution ]        |   | In stock. Delivery in Nairobi 1–2 working    | |
| |                                              |   | days. Pickup from Mombasa Road available.    | |
| | Safety                                   (h2)|   | (PO to confirm)                              | |
| | [!] Irritant. Wear gloves and eye protection |   +----------------------------------------------+ |
| | Safety data sheet (PDF, 240 KB)              |   (this column is sticky while the left scrolls)   |
| | Certificate of analysis (PDF, 90 KB)         |                                                    |
| |                                              |                                                    |
| | Goes with                                (h2)|                                                    |
| | [img] Trigger spray bottle 750 ml, green     |                                                    |
| | [img] Dosing pump for 5 L                    |                                                    |
| |                                              |                                                    |
| | Specifications                           (h2)|                                                    |
| | Active         QAC (benzalkonium chloride)   |                                                    |
| | pH             7.5–8.5                        |                                                    |
| +----------------------------------------------+                                                    |
+------------------------------------------------------------------------------------------------------+
```

### 4.9 Checkout — 360 px

Checkout is a stepper: Contact → Delivery → Payment → Review. Each step is one screen; the order summary
is a collapsible strip at the top so the total is never out of sight.

```
+----------------------------------------+
| Safuney                     Secure     |
+----------------------------------------+
| Order total  KES 12,480.00   [Show] v  |   <- collapsible summary strip (ground-deep)
+----------------------------------------+
| 1 Contact  2 Delivery  3 Payment  4 Review
| ===========-----------------------------|   <- teal progress
+----------------------------------------+
| Payment                           (h1) |
|                                        |
| (o) M-Pesa                             |
|     Phone number for the request       |
|     [ 07__ ___ ___          ]          |
|     We will send a payment request     |
|     to this number.                    |
| ( ) Card (Visa, Mastercard)            |
| ( ) Invoice — organisation account     |
| ( ) Cash on delivery                   |
|                                        |
| [ Pay KES 12,480.00 with M-Pesa ]      |
| [ Back to delivery ]                   |
+----------------------------------------+

after tapping Pay:

+----------------------------------------+
| Check your phone                  (h1) |
| Enter your M-Pesa PIN to pay           |
| KES 12,480.00 to Safuney Limited.      |
|                                        |
|   (o)   waiting — 1:42 remaining       |   <- single spinner, mono countdown
|                                        |
| Didn't get it?                         |
| [ Send the request again ]             |
| [ Pay another way ]                    |
+----------------------------------------+

if it times out:

| [!] The M-Pesa request timed out.      |
|     Nothing was charged. Send it       |
|     again, or choose another way to    |
|     pay.                               |
```

Review step shows: items with pack size and quantity, subtotal, VAT 16%, delivery fee (zone and slot
named), total; delivery address; payment method; then "Place order". Order confirmation shows the order
number in mono, the M-Pesa receipt code, and "Download invoice (PDF)".

### 4.10 Checkout — 1280 px

```
+------------------------------------------------------------------------------------------------------+
| Safuney                                                                            Secure checkout    |
+------------------------------------------------------------------------------------------------------+
| +---------------------------------------------------------------+  +-------------------------------+ |
| | 1 Contact  ✓     2 Delivery  ✓     3 Payment     4 Review     |  | Your order            (h3)    | |
| | ======================================-----------------------  |  |                               | |
| |                                                               |  | [img] QAC surface sanitiser    | |
| | Payment                                                  (h1) |  |       5 L  x 4   KES 5,000.00 | |
| |                                                               |  | [img] Chlorine disinfectant    | |
| | (o) M-Pesa                                                    |  |       20 L x 2   KES 7,480.00 | |
| |     Phone number for the request                              |  |                               | |
| |     [ 07__ ___ ___              ]                             |  | Subtotal         KES 10,758.62| |
| |     We will send a payment request to this number.            |  | VAT 16%          KES  1,721.38| |
| | ( ) Card (Visa, Mastercard)                                   |  | Delivery, Nairobi KES     0.00| |
| | ( ) Invoice — organisation account (30-day terms)             |  | Total            KES 12,480.00| |
| | ( ) Cash on delivery                                          |  |                    (price-lg) | |
| |                                                               |  |                               | |
| | [ Pay KES 12,480.00 with M-Pesa ]   Back to delivery          |  | Deliver to                    | |
| |                                                               |  | Kitchen stores, Block B,      | |
| +---------------------------------------------------------------+  | Westlands.  Edit              | |
|                                                                    +-------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

The checkout header drops the full navigation (one exit: the logo) but keeps the "Secure checkout" label
and a phone number for help. The summary column is sticky.

### 4.11 Grid

- Mobile: 4 columns, 20 px side padding, 16 px gutter.
- Tablet (≥ 768 px): 8 columns, 32 px padding, 24 px gutter.
- Desktop (≥ 1024 px): 12 columns, 24 px gutter, container 1200 px centred.
- Product listing: 2 / 3 / 4 columns at the three breakpoints.

---

## 5. Motion

**One orchestrated moment, on first load of the home page only.** The hero photograph fades in over
400 ms as it decodes; 120 ms after it completes, the four zone bands fill left-to-right (`scaleX` from 0
to 1, transform-origin left) over 480 ms each, staggered by 80 ms — red, blue, green, yellow — like four
dosing lines filling. The product counts fade in as each band completes. Total sequence under 1.2 s. It
runs once per session (a `sessionStorage` flag; if storage throws, it simply runs again).

**Everything else moves only in response to the user:**

| Trigger | Motion | Duration / easing |
| --- | --- | --- |
| Hover on a link | Underline thickness 1 → 2 px | 120 ms, ease-out |
| Hover on a primary button | Fill `accent` → `accent-deep` | 120 ms |
| Add to cart | Button label swaps to "Added — view cart" (tick), cart count increments with a 160 ms scale 1 → 1.15 → 1 | 160 ms |
| Open filter sheet / nav sheet / cart drawer | Slide from edge with backdrop fade | 240 ms, `cubic-bezier(0.2, 0, 0, 1)` |
| Close any sheet | Reverse, faster | 160 ms |
| Select a pack size | Radio border 1 → 2 px `accent`, price crossfades | 120 ms |
| Form error appears | Message fades in; the field border changes colour instantly (no animation on the thing you need to read) | 120 ms |
| M-Pesa waiting state | One spinner and a countdown; no pulsing, no skeleton shimmer | — |

Nothing autoplays: no carousels, no parallax, no scroll-triggered reveals, no number counters, no
hover-lift on cards.

**`prefers-reduced-motion: reduce`:** the load sequence is skipped and the bands render already filled;
all transitions are reduced to opacity changes of ≤ 120 ms or removed; sheets appear in place. The
existing rule in `globals.css` (duration forced to 0.01 ms) is kept as the safety net.

---

## 6. Component principles

### 6.1 Buttons

- The label is the outcome, in sentence case, plain verb first: **Add to cart**, **Pay KES 12,480.00
  with M-Pesa**, **Request a quote**, **Download safety data sheet**, **Send the request again**,
  **Place order**. Never "Submit", "OK", "Go", "Learn more", "Click here".
- One primary button per view. Primary = `ink` fill, white text (not teal — teal is reserved for links and
  states so that a page with three teal things does not shout). Secondary = 1 px `stainless` border, ink
  text, `surface` fill. Tertiary = teal text link with underline. Destructive (remove from cart, cancel
  order) = secondary style with the label saying what is removed: **Remove QAC sanitiser 5 L**.
- Minimum height 44 px, minimum width 44 px, horizontal padding 20 px. Full-width on mobile when it is the
  page's main action.
- Disabled buttons are avoided: instead the button stays enabled and pressing it explains what is missing
  ("Choose a pack size first"). Where disabling is unavoidable (payment in flight), the label changes to
  the state: **Sending M-Pesa request…**.
- Loading state keeps the button's width (no layout shift) and shows the state in words, not only a spinner.

### 6.2 Links

Underlined by default in body copy (1 px, `text-underline-offset: 3px`), `accent` colour. No arrows,
chevrons or "→" appended. Navigation and card-title links are not underlined at rest but are the whole
card/hit area (min 44 px) and underline on hover and focus.

### 6.3 Forms

- Label above the field, always visible; never placeholder-as-label. Helper text under the label, in
  `small`, before the user makes a mistake ("Safaricom number, 07xx or 01xx").
- Inputs: 48 px tall, `surface` fill, 1 px `stainless` border (4.23:1 — meets the 3:1 component rule),
  radius 2 px. Focus: 2 px `accent` border plus the global 3 px outline.
- Phone number input uses `inputmode="tel"` and formats as `07xx xxx xxx`; the country is Kenya, so the
  +254 prefix is implied and shown as static text, not typed.
- Money is entered and shown as `KES 1,250.00`; the server converts to minor units. Never a bare number.

### 6.4 Errors say what went wrong and how to fix it

| Situation | Message |
| --- | --- |
| Empty required field | "Enter the phone number that should receive the M-Pesa request." |
| Bad phone format | "That does not look like a Kenyan mobile number. Use 07xx xxx xxx or 01xx xxx xxx." |
| Out of stock after adding | "QAC sanitiser 20 L sold out while it was in your cart. Choose 5 L, or ask us when 20 L is back." |
| M-Pesa timeout | "The M-Pesa request timed out. Nothing was charged. Send it again, or choose another way to pay." |
| M-Pesa cancelled on phone | "The payment was cancelled on your phone. Nothing was charged. Try again when you are ready." |
| Card declined | "Your bank declined the card. Nothing was charged. Try another card or pay with M-Pesa." |
| Delivery outside zones | "We do not deliver to Kisumu yet. You can collect from Mombasa Road, Nairobi, or ask us for a courier quote." |
| Server error | "Something went wrong on our side and the order was not placed. Your cart is saved. Try again in a minute, or call +254 796 808 822." |

Errors appear next to the field (with `aria-describedby`) and, for form-level failures, in a summary at the
top of the form that receives focus. They are never toast-only.

### 6.5 Empty states invite action

| Empty state | Copy and action |
| --- | --- |
| Empty cart | "Your cart is empty. Start with the zone you clean most." + the four zone bands. |
| No products match filters | "Nothing matches all of those filters. Remove one, or ask us — we can usually source it." + [Clear filters] [Request a quote]. |
| No search results | "No products found for 'degreser'. Check the spelling, or browse Foodservice and kitchen hygiene." (suggests the closest category). |
| No orders yet (account) | "You have not ordered online yet. Orders placed by phone before September 2026 are not shown here — ask us for a statement." |
| Category with unreviewed products only | Category is hidden from navigation, not shown empty. |

### 6.6 Badges and chips

- Zone badge: 8 px square swatch, 6 px gap, zone word in `label` size, sentence case, on a `surface`
  pill with 1 px `line` border, radius 2 px. Yellow uses ink text on the yellow swatch only; the word is
  always `ink`.
- Hazard badge: warning colours (§2.3), the hazard word, and the GHS pictogram at 16 px.
- Pack chips on cards: `mono-sm`, `ground-deep` fill, radius 2 px, not interactive on the card (they
  describe, the product page selects).
- Filter chips: `surface`, 1 px `stainless` border; selected = `accent-wash` fill, 2 px `accent` border,
  tick icon before the word.

### 6.7 Tables

Every dilution chart, spec sheet and order summary is a real `<table>` with `<th scope>`. Header row on
`ground-deep`, 1 px `line` rules, `tnum` numerals right-aligned, mono for ratios. On mobile, tables scroll
horizontally inside their own container; they never break the page width.

---

## 7. Spacing, radius, shadow, border

### 7.1 Spacing scale

Base 4. Tokens: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128` px.

| Use | Value |
| --- | --- |
| Inside a badge / chip | 4 × 8 |
| Inside a button | 12 × 20 |
| Inside an input | 12 × 16 |
| Between label and field | 8 |
| Between fields | 24 |
| Between a heading and its content | 16 (h3/h4), 24 (h2) |
| Between cards in a listing | 16 mobile, 24 desktop |
| Between sections | 64 mobile, 96 desktop |
| Page side padding | 20 mobile, 32 tablet, 24 desktop (inside the 1200 container) |

### 7.2 Radius policy

Radius carries meaning: square things are *material* (photographs, swatches, tables), slightly rounded
things are *tools* (buttons, inputs), and clearly rounded things are *transient* (sheets, toasts).

| Radius | Applies to |
| --- | --- |
| `0` | Photographs, product images, zone bands and swatches, tables, the hero, section containers, product cards |
| `2 px` | Inputs, chips, badges, pack-size radios, thumbnails |
| `4 px` | Buttons |
| `12 px` | Top corners of bottom sheets, drawers, dialogs, toasts |
| `999 px` | Only the cart count bubble and the floating WhatsApp button |

Never the same radius on a card and a button; never a rounded photograph.

### 7.3 Shadow policy

Nothing that sits on the page has a shadow. Only things that *float above* it do, and they share one
shadow: `0 8px 24px rgba(16, 32, 43, 0.16)` — tinted with `ink`, not grey. Applies to: sticky
add-to-cart bar, sheets, drawers, dropdown menus, toasts. Cards, inputs and buttons have no shadow at any
state, including hover.

### 7.4 Border policy

| Border | Use |
| --- | --- |
| 1 px `line` `#CBD5DB` | Decorative containment: product image frame, table rules, section dividers, footer top |
| 1 px `stainless` `#6F7D87` | Interactive edges that must be perceivable: inputs, secondary buttons, unselected chips |
| 2 px `accent` | Selected: pack-size radio, filter chip, active nav item |
| 2 px `ink` | Error field border |
| 6 px zone colour | The band under a product photo; split into equal segments for multi-zone products |
| 4 px zone colour, left | Rows in the "Where will you use it?" list on mobile |

---

## 8. Imagery

Photography follows `docs/design/photography.md`. Design rules that depend on it:

- Product images are shot on seamless white and placed on `surface` with a 1 px `line` frame, so the
  cut-out edge is never visible and the bottle sits "in" the frame.
- The home hero and category headers use the *context* shots (stainless bench, wet surfaces, foam) at
  full bleed, uncropped by text.
- No illustration, no icons larger than 24 px, no abstract blobs. The only decorative graphic on the site
  is the zone band.
- Until the PO's photographs exist, product tiles show a flat `ground-deep` square with the product name
  set in `h4` — not a stock image and not a placeholder icon. The placeholder guard in CI does not flag
  this because the text is the real product name.

---

## 9. Accessibility floor

- **WCAG 2.1 AA** throughout; text contrast ≥ 4.5:1, UI components and zone bands ≥ 3:1 against
  their background (all pairs in §2 verified; yellow is fill-only).
- **Visible focus:** 3 px `accent` outline, 2 px offset, on every focusable element. On `ink` or teal
  surfaces the outline is white. Focus is never removed, only restyled.
- **360 px first.** Every layout in §4 is designed at 360 first and widened. No horizontal scroll at 320.
- Touch targets ≥ 44 × 44 px, 8 px minimum between targets.
- Colour never alone: zones carry the word, hazards carry the word and pictogram, errors carry text and icon.
- Sheets and dialogs trap focus, restore it on close, and close on Escape.
- `lang="en-KE"`; prices announced as "Kenyan shillings" by screen readers via visually hidden text.
- Skip link to main content on every page; landmark regions (`header`, `nav`, `main`, `footer`).
- Zoom to 200 % without loss of content; type scale uses `rem`, layout uses `px` only for hairlines.
- Reduced motion honoured (§5). No content flashes more than three times per second — nothing flashes at all.
- Axe and Playwright checks run in CI from Phase 1; Lighthouse accessibility score must be 100 on the
  four page types in §4.

---

## 10. Review against generic tells

An honest pass over this plan against the list of defaults, and what changed because of it.

| Tell | Present in first draft? | Verdict and change |
| --- | --- | --- |
| Cream background + serif + terracotta accent | No. | Ground is a cool white, type is a grotesk, accent is teal. Nothing to change. |
| Near-black + acid green | Partly. `ink` `#10202B` is near-black, and green is in the zone set. | Green is functional only: it is never the accent, never "success", never a button. Success now uses `accent` teal (§2.3). Ink is blue-black rather than neutral black so the pairing reads as steel, not as a terminal. |
| SaaS card grid, identical radii, grey shadows | Yes, in the first pass of §4.5 — I had drawn 8 px rounded cards with a soft shadow on hover. | Cards are now radius 0 with a 1 px frame around the photo only, a zone band, text on bare ground, and no shadow at any state (§4.6, §7.2, §7.3). The one shadow on the site is ink-tinted and reserved for floating surfaces. Category list on the home page became a two-column ledger, not cards. |
| ALL-CAPS eyebrow labels over every heading | Yes — the home hero had "Cleaning chemicals · Kenya" as an eyebrow, and each home section had one. | Removed every eyebrow. Sections have a sentence-case h2 and nothing above it. Badges are sentence case. There is no uppercase text on the site other than acronyms (QAC, SDS, KES, VAT). |
| Middle-dot meta strings ("5 L · 4 per case · Corrosive") | Yes, in the product card and footer legal line. | Meta is now separate elements: pack sizes as chips, hazard as a badge, footer links as a list with 24 px gaps. Where two facts must share a line they are separated by a comma or an en dash. |
| Arrows appended to every link | Yes — "Browse products →", "Read the guide →". | Removed. Links are underlined; buttons say the outcome. The only chevron on the site is the ">" in the mobile zone rows, which is a disclosure affordance on a full-width row, not a decoration on a link. |
| A single accent-coloured word in a headline | Considered ("…use them **correctly**." in teal). | Rejected. Headlines are one colour. Emphasis, where needed, is weight 600 on the whole sentence. |
| Stock-photo people in lab coats | Not in the plan, but the risk sits in the photography brief. | `photography.md` forbids it explicitly and specifies what replaces it: real products, real surfaces, hands in gloves doing actual work, no faces, no pointing. |
| Gradient hero with a big number | No. | The hero is a photograph with the headline below it. Statistics ("500+ products") do not appear anywhere; counts appear only where they are live data (products per zone). |
| Rounded "pill" buttons everywhere | Yes, inherited from the holding page's `rounded-full` industry chips. | Buttons are 4 px; the only full-round elements are the cart count and the WhatsApp button (§7.2). Industry list on the home page is plain text, comma-separated. |

Net effect of the review: fewer decorative elements, more information density, one accent, one shadow,
one animation.

---

## 11. Handover to code (Phase 1 tickets)

1. Replace the `@theme` block in `apps/web/app/globals.css` with the tokens in §2 and §7 (`--color-ground`,
   `--color-ink`, `--color-accent`, `--color-zone-red` … `--radius-tool: 4px`, `--shadow-float`).
2. Load IBM Plex Sans (400/500/600) and IBM Plex Mono (400/500) via `next/font/google` in
   `apps/web/app/layout.tsx`; expose as `--font-sans` and `--font-mono`.
3. Build primitives in `packages/ui`: Button (primary/secondary/tertiary), Input, ZoneBadge, HazardBadge,
   PackChip, ProductCard, DilutionTable, Sheet, Toast, ProgressSteps.
4. Storybook-free: each primitive gets a page under `/design` (noindex) that renders every state, and a
   Playwright + axe test against it.
5. Update `themeColor` in `layout.tsx` to `#10202B`.

Open items that block nothing but need the PO: brand assets (Q5), brand list for the filter (Q6), VAT
display rule (Q7), delivery promises quoted in the wireframes (Q8), opening hours and KRA PIN for the footer
(Q3, Q4).
