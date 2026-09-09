# Updating the catalogue with a spreadsheet

**For:** the person who keeps Safuney's prices right. You need a spreadsheet program and an
administrator sign-in. Nothing else.

This is how you change many products at once — a price rise across the range, new pack sizes, corrected
descriptions. For one price, just type it into the row on `/admin/catalogue`.

---

## The short version

1. `/admin/catalogue` → **Export CSV**
2. Open it in Excel, LibreOffice or Google Sheets. Edit.
3. Save as **CSV** (not .xlsx).
4. `/admin/catalogue` → **Import CSV** → choose the file.
5. **Read what it says will change.**
6. Press **Import**.

Nothing is written until you press Import. You always see the changes first.

---

## What each column means

| Column | What to put |
| ------ | ----------- |
| `sku` | The product code. **Never change this** — it is how a row is matched to the product. Change it and you create a new product. |
| `product_slug` | The web address of the product. Changing it breaks existing links. |
| `product_name` | The name customers see. |
| `brand` | Optional. |
| `category_slug` | Which section it sits in. Must already exist. |
| `short_description` | The one line under the name. |
| `hazard_class` | One of NONE, IRRITANT, CORROSIVE, OXIDISER, FLAMMABLE, HARMFUL, ENVIRONMENTAL. |
| `needs_po_review` | `yes` keeps it hidden from customers, `no` makes it visible. |
| `product_active` | `no` hides it completely. |
| `pack_label` | What customers see: "5 L", "20 L". |
| `pack_size_value` / `unit` | The number and the unit: `5` and `L`. Units: L, ML, KG, G, PCS. |
| `price_kes` | Price per pack **excluding VAT**, in shillings. `1250` or `1250.50`. |
| `compare_at_kes` | A "was" price, or leave empty. |
| `vat_rate_bps` | 1600 means 16%. Leave it unless you know why you are changing it. |
| `stock_on_hand` | How many packs you physically have. |
| `low_stock_threshold` | When to warn you. |
| `made_to_order` | `yes` if you make it when ordered rather than holding stock. |
| `variant_active` | `no` hides this pack size but keeps the product. |
| `seo_title` / `seo_description` | What Google shows. Leave empty and the name and description are used. |

---

## The rules, and why

**A bad row rejects the whole file.** If line 40 has a price the system cannot read, nothing is
imported — not even lines 1 to 39. A half-updated price list is worse than one that was rejected,
because nobody can tell by looking which half applied.

**The same SKU twice in one file is an error.** Rather than silently letting the second one win, which
is how a price gets reverted without anyone noticing.

**Reserved stock is never touched.** Those packs belong to orders that have not gone out. If you set
`stock_on_hand` below what is already reserved, the row is refused and it tells you the number.

**Every stock change is recorded** as a movement, exactly like a delivery or a dispatch, so the history
adds up.

---

## Reading the preview

Four numbers: **new**, **changed**, **unchanged**, **with a problem**.

Then a row for each thing that would change, showing the field and both values:

```
price_kes    1250.00 → 1400.00
stock_on_hand      12 → 40
```

**Read this every time.** It is the last chance to notice that a spreadsheet turned `1250.00` into
`1,250` or a decimal moved. Prices go live to customers within seconds of pressing Import.

If there is a problem, the message names the line, the column and the value:
`Line 40: price_kes: "twelve hundred" is not an amount in shillings.`
Fix it in your spreadsheet, save, upload again.

---

## Traps

**Excel and the leading zero.** A SKU like `0123` becomes `123`. Format the SKU column as **Text**
before you type in it, or the row will not match a product and will create a new one.

**Excel and dates.** A pack size like `5-10` can become a date. Same fix: format as Text.

**Save as CSV, not .xlsx.** The upload only reads CSV. Most spreadsheets warn you that formatting will
be lost when you save as CSV — that is fine, there is no formatting to lose.

**A stale export.** The import writes *every* row in the file, not just the ones you changed. If you
exported last week and someone changed a price since, importing your old file puts the old price back.
The preview will show that as a change — which is exactly why you read it. When in doubt, export fresh.

---

## Publishing new products

A brand-new product arrives hidden (`needs_po_review` = `yes`). Once you are happy with it, either set
that column to `no` and re-import, or press **Needs review — publish** on the row in
`/admin/catalogue`.

**Nothing marked for review is ever visible to a customer, or to Google.** That is the safety net under
the whole catalogue: an unfinished product cannot leak.
