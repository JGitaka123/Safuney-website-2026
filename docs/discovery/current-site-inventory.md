# Current site inventory — safuney.com

**Date:** 2026-09-09
**Method:** the site could not be fetched from the build environment (egress blocked for `safuney.com`,
`www.safuney.com` and `web.archive.org`). Everything below comes from (a) search-engine snippets of
safuney.com pages, and (b) the harvested copy in the master brief §3.1. Items are tagged:

- **[brief]** — text supplied in the master brief, taken from the live site by the PO.
- **[snippet]** — text shown in a search-engine result for a safuney.com URL. Wording may be truncated.
- **[inferred]** — a page that a site of this template almost certainly has, but that was not observed.

A full crawl from the PO's machine (`current-site/README.md`) will replace this file. Until then, treat
every contact detail as *unconfirmed*; see `questions-for-po.md`.

## 1. Pages and URLs observed

| # | URL | Title / purpose | Tag |
| --- | --- | --- | --- |
| 1 | `https://safuney.com/` | Home — "Safuney Limited" | [snippet] |
| 2 | `http://safuney.com/products.php?a=Disinfection+and+Sanitization` | Category: Disinfection and Sanitization | [snippet] |
| 3 | `https://safuney.com/products.php?a=specialty+products` | Category: Specialty Products | [snippet] |
| 4 | `https://www.safuney.com/products.php?a=Personal+Hygiene` | Category: Personal Hygiene | [snippet] |
| 5 | `products.php?a=<other categories>` | Foodservice, Laundry, Healthcare, Laboratory, Janitorial pages probably exist under the same pattern | [inferred] |
| 6 | about / services / contact pages | Not observed; the template usually has `about.php`, `services.php`, `contact.php` | [inferred] |

Notes for Phase 9 redirects:

- The site is PHP with query-string category routing (`products.php?a=<Category Name>`). Redirect rules
  must match on the `a` parameter, URL-encoded with `+` for spaces, case-insensitively (observed both
  `Disinfection+and+Sanitization` and `specialty+products`).
- Both `safuney.com` and `www.safuney.com` are indexed, and both `http` and `https`. All four forms must
  301 to the chosen canonical host.

## 2. Copy, by page

### Home `/`

- Positioning **[brief][snippet]**: "Safuney Limited offers professional cleaning and hygiene solutions
  and support services to Institutional, hospitality, Industrial and commercial customers."
- Foodservice **[brief]**: "Our solutions cover the food and beverage industry with a comprehensive range of
  detergents, degreasers and disinfectants." / "Foodservice chemicals … essential to keeping your commercial
  kitchen clean and safe for your employees and customers."
- Laundry **[brief]**: commercial laundry detergents and fabric conditioners "made to deliver great results
  with just one wash."
- Healthcare **[brief]**: medical-equipment cleaning "requires critical cleaning for use in demanding human
  health and veterinary applications."
- Laboratory **[brief]**: "products for critical and precision cleaning of laboratory equipment, glassware
  and safety ware."
- Industries served **[brief][snippet]**: Hospitality, Gaming, Recreational, Country Club(s), Maintenance
  Contractors, Healthcare, Industrial, Agricultural, Foodservice, Education.
- Value claims **[brief][snippet]**: "independent supplier"; "quality branded products"; "extensive,
  continually expanding product line to serve your janitorial and food service needs"; "prides itself on
  providing solutions to meet customer needs while delivering value and superior service".
- Services **[snippet]**: "Training services that instill professionalism and pride"; "Service and repair
  for all types of cleaning equipment"; "House Keeping services to create a healthy workplace".
- **Placeholder copy present [brief]:** "Paragraph of text beneath the heading to explain the heading. Here
  is just a bit more text." — appears under one or more section headings. Must not be carried over.

### Category: Disinfection and Sanitization **[snippet]**

Products named:
1. QAC-based sanitizer for surface and food-contact areas
2. Powder chlorine-based salad and fruits cleaner
3. General purpose cleaner disinfectant
4. Chlorine-based disinfectant and bleaching solution
5. Alcohol-based hand sanitizer liquid / gel

### Category: Specialty Products **[snippet]**

Products named:
1. Descaler for kitchen and other housekeeping equipment
2. Oven / grills / hoods cleaner — pack sizes 5 L and 20 L
3. Destainer for crockery and cutlery — 15 kg
4. Enzyme-based biological drain cleaner and septic tank treatment

### Category: Personal Hygiene **[snippet]**

Page exists; no product names were visible in the snippet.

### Foodservice, Laundry, Healthcare, Laboratory

Only the category-level sentences above were observed. No individual products, brands, pack sizes or
prices were visible anywhere.

## 3. Contact details observed

| Field | Value | Tag | Confirmed by PO? |
| --- | --- | --- | --- |
| Phone | +254 796 808 822 | [snippet] | no |
| Email | info@safuney.com | [snippet] | no |
| Office | Park View Heights – Mombasa Road, Mezzanine 3, Office A, Nairobi | [snippet] | no |
| Postal | P.O. Box 34079 – 00100, Nairobi | [snippet] | no |
| WhatsApp | not observed | — | — |
| Opening hours | not observed | — | — |
| KRA PIN / VAT | not observed | — | — |
| Social links | not observed | — | — |

## 4. Images and documents

None could be observed. Expect: a logo (probably PNG/JPG, not SVG), a hero image, category thumbnails
from the template. No SDS, COA, brochures or price lists were found in search indexes. The crawl from the
PO's machine will fill this section (filename, dimensions, alt text, page).

## 5. Defects and risks on the current site

1. Template placeholder copy live on the home page (non-negotiable #6 for the rebuild).
2. Mixed `http`/`https` and `www`/apex indexing — split ranking signals.
3. Query-string category URLs — poor for SEO and sharing; must be redirected, not dropped.
4. No product detail pages, prices, pack sizes, SDS or ordering — the site cannot take an order.
5. No structured data, no sitemap observed, no privacy policy (Kenya DPA 2019 requirement once any form
   collects PII).
6. Brand and category names use inconsistent casing ("Sanitization" / "specialty products").
