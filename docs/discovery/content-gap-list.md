# Content gap list — what a top-tier hygiene supplier site has that safuney.com lacks

**Date:** 2026-09-09. Each gap says who supplies the content (PO, Claude from PO input, or Claude alone)
and which phase closes it. Nothing in the "PO" column will be invented.

## A. Trust and legal (Kenya)

| Gap | Why it matters | Source | Phase |
| --- | --- | --- | --- |
| Registered company name, KRA PIN, VAT registration status | Required on tax invoices; B2B buyers check it before opening an account | PO | 1 (footer), 3 (invoices) |
| Physical address with map, landmark, opening hours | Trust for first-time buyers; "pickup at warehouse" needs it | PO (confirm harvested address) | 1 |
| WhatsApp business line, click-to-chat | Primary contact channel for Kenyan B2B buyers | PO | 1 |
| Privacy policy, cookie notice, consent for marketing | Kenya Data Protection Act 2019 | Claude drafts, PO approves | 1 |
| Terms of sale, delivery terms, returns and damaged-goods policy | Checkout cannot go live without them | PO rules → Claude drafts | 1 |
| Certifications and memberships (KEBS, ISO, supplier accreditations) | Only those the PO can evidence | PO | 7 |

## B. Product information

| Gap | Why it matters | Source | Phase |
| --- | --- | --- | --- |
| Individual product pages with pack sizes, prices, VAT line, stock status | The site cannot take an order today | PO (catalogue CSV) | 2 |
| Brand names — what Safuney distributes vs manufactures | Search intent is often brand-led; also a legal claim | PO | 0 → 2 |
| Safety Data Sheets (SDS) per product | Required by institutional and healthcare procurement | PO / brand principals | 2, 8 |
| Certificates of Analysis (COA) | Foodservice and healthcare audits | PO / principals | 2, 8 |
| Dilution guidance and dilution calculator | The number-one support question for concentrates | PO supplies ratios; Claude builds | 2 |
| Hazard classification and pictograms | Legal labelling; also filters "safe for food-contact" | PO / SDS | 2 |
| Application guidance ("how to use", contact time, surface compatibility) | Reduces misuse and returns | PO / SDS → Claude | 2 |
| Compatible dispensers, dosing equipment and consumables | Attach-rate and correct dosing | PO | 2 |
| Colour-coded cleaning system guide (red/blue/green/yellow zones) | Industry convention; becomes a navigation device | Claude drafts, PO approves | 7 |
| Product photography (real, consistent) | Interim renders must be replaced | PO shoots per `docs/design/photography.md` | 1 → 2 |

## C. Commerce and B2B

| Gap | Source | Phase |
| --- | --- | --- |
| Online ordering with M-Pesa, card, invoice and COD | Claude | 3 |
| Delivery zones, fees, free-delivery threshold, slots, pickup option | PO rules | 3 |
| Minimum order value | PO | 3 |
| Credit-account onboarding, terms, limits, statements | PO policy | 4 |
| Request-for-quote for bulk or uncatalogued needs | Claude | 4 |
| Order sheet / bulk ordering for facilities | Claude | 2 |
| Customer-specific price lists | PO | 4 |

## D. Content and authority

| Gap | Source | Phase |
| --- | --- | --- |
| Solutions by industry (Hospitality, Healthcare, Foodservice, Education, Industrial, Facilities management) | Claude drafts from confirmed catalogue | 7 |
| Resources: dilution charts, HACCP cleaning schedules, infection-prevention basics, colour-coding guide | Claude drafts, PO reviews for accuracy | 7 |
| Case studies and named clients | Only real, PO-approved | 7 |
| About: history, team, values, service area | PO | 1, 7 |
| Careers | PO | 7 |
| Swahili locale for navigation and checkout | Claude, PO reviews | 7 |

## E. Technical

| Gap | Phase |
| --- | --- |
| HTTPS-only, single canonical host, clean URLs, 301 map from every old URL | 9 |
| Sitemap, robots, structured data (Organization, LocalBusiness, Product, Breadcrumb, FAQ) | 7 |
| Mobile performance (LCP < 2 s on 4G), accessibility (WCAG 2.1 AA) | 1 onward, CI-enforced |
| Search on site | 2, 8 |
| Analytics, error monitoring | 1 |
