# catalogue-seed.csv — how to read and correct it

One row per **product variant** (a product in one pack size). Rows with an empty `product_slug` are
category headers and carry no product. Every price is `0` and every row is `needs_po_review=true`
because no prices, brands or pack sizes are published on the current site and none were invented.

| Column | Meaning | Who fills it |
| --- | --- | --- |
| `category_slug`, `category_name`, `parent_category_slug` | Category tree; leave `parent_category_slug` empty for top level | Claude; PO may rename |
| `product_slug` | URL slug, unique per product | Claude |
| `product_name` | Customer-facing name | PO corrects |
| `brand` | Manufacturer / brand name — **empty until PO confirms what Safuney distributes vs makes** | PO |
| `short_description` | One sentence | Claude drafts, PO corrects |
| `pack_size`, `unit` | e.g. `5` + `L`, `15` + `kg`, `12` + `pcs` | PO |
| `sku` | Safuney's own code | PO |
| `price_minor_units` | Price in **KES cents**, integers only (KES 1,250.00 → `125000`) | PO |
| `compare_at_minor_units` | Optional "was" price in cents; `0` = none | PO |
| `vat_rate_bps` | VAT in basis points; `1600` = 16 %; `0` = zero-rated/exempt | PO confirms per product |
| `hazard_class` | e.g. `corrosive`, `irritant`, `oxidiser`, `flammable`, `none` — from the SDS | PO / SDS |
| `dilution_guidance` | e.g. `1:40 general; 1:10 heavy soil` — from the label or SDS | PO / SDS |
| `source` | Where the row came from: `brief`, `snippet`, `crawl`, `po` | Claude |
| `needs_po_review` | `true` until the PO has checked the row; unreviewed rows never show on the live site | PO flips to `false` |

The PO can edit this file in Excel and commit it, or wait for the admin CSV import in Phase 6.
Whether prices are entered VAT-inclusive or exclusive is an open question (`questions-for-po.md` Q7);
until answered, enter the **VAT-exclusive** price and the import will compute the inclusive figure.
