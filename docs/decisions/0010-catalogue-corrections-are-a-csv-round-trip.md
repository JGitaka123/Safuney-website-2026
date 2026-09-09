# 0010 — Catalogue corrections are a CSV round trip with a diff preview

**Status:** accepted · **Date:** 2026-09-09

## Decision
The catalogue is exported as one CSV row per variant, edited in a spreadsheet, and re-imported. The
import shows a field-level diff — new, changed, unchanged, error per row — and writes nothing until the
operator confirms it. Any row with a problem rejects the whole file. The applied import runs in one
transaction, and stock corrections go through `InventoryMovement` like every other stock change.

## Why
The catalogue harvested for Phase 2 is provisional: names, pack sizes and prices all need the PO's
correction before launch, and `needsPoReview` currently hides most of it from customers. Correcting a
few hundred variants one form at a time is the wrong shape of work. A spreadsheet is the tool the PO
already has.

The diff is the part that matters more than the upload. These are live prices; a decimal in the wrong
place is a real loss, and a spreadsheet will happily turn `1250.00` into `1,250` or a date. Showing
exactly what would change, before anything changes, is what makes the round trip safe to hand over.

Rejecting the whole file on any bad row rather than importing the good ones: a half-applied price list
is worse than a rejected one, because nobody can tell by looking which half applied.

## Consequences
- The export must be losslessly re-importable, and a test asserts it: export, import, zero changes.
  `pack_size_value` is compared as text because Postgres returns `5.000` for a `Decimal(10,3)`.
- `stockReserved` is never written by an import. Those units belong to live orders, and a stock count
  that ignored them would let the site sell stock twice. A count below what is reserved is refused,
  naming the reserved quantity.
- A SKU appearing twice in one file is an error, not a last-one-wins: silently applying the later row
  is how a price gets reverted without anyone noticing.
- CSV parsing is hand-rolled (`apps/web/lib/admin/csv.ts`), about 40 lines, RFC 4180 shaped, with the
  Excel BOM tolerated. A dependency for this would be more surface than the format.

## Alternatives considered
- **Direct spreadsheet integration (Google Sheets API).** Another credential, another vendor, and no
  diff step — edits would land live.
- **Import without a preview.** Faster, and exactly the failure mode this decision exists to prevent.
