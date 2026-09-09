# Phase 6 plan — admin console

**Date:** 2026-09-09 · **Status:** planned · Spec: master prompt §6 Phase 6.

## Scope (from the brief)
1. Dashboard: sales today / 7 days / 30 days, orders by status, low stock, pending quotes, pending
   credit approvals, failed payments.
2. Products and variants with bulk CSV import and export (this is where the PO fixes the catalogue),
   image upload, document upload, SEO fields, `needsPoReview` filter.
3. Orders: search, filter, evented status changes, refunds and credit notes, manual payment recording,
   invoice regeneration.
4. Customers: view, approve credit, set price list, notes.
5. Promotions, coupons, delivery zones, content pages, homepage merchandising, review moderation, leads
   inbox, audit log.
6. **Gate:** every admin mutation has an authorisation test (a non-admin cannot call it) and an
   audit-log test.

## What already exists
Sales desk (`/sales`) prices quotes; finance decides credit at `/sales/credit`; the warehouse board
runs fulfilment. `AuditLog` is written by the organisation, credit and quote services. Staff sign in
with password and TOTP. Phase 6 is the console around all of it.

## The shape that makes the gate cheap
Rather than hand-rolling authorisation and audit per route, everything goes through one seam:

```
adminAction(permission, handler)   // apps/web/lib/admin/action.ts
```

- Resolves the viewer, refuses anyone without the permission, and records an `AuditLog` row with the
  actor, entity, before and after — so the two required tests are one test per action, and a new action
  cannot forget either. A registry of actions lets a single test iterate every one of them and assert
  that a customer, a buyer and each wrong staff role are all refused.
- Permissions map to roles: `SALES` (quotes, customers, leads), `WAREHOUSE` (fulfilment, stock),
  `FINANCE` (credit, payments, invoices, refunds), `ADMIN` (all, plus catalogue, content, staff).

## Workstreams
### A. Shell and dashboard
`/admin` with role-aware navigation. Dashboard reads: sales by day from `Order` (paid and confirmed),
counts by status, variants under `lowStockThreshold`, quotes `REQUESTED`, credit applications
`PENDING`, payments `FAILED` in the last 7 days. One query per tile, all indexed.

### B. Catalogue
- List with the `needsPoReview` filter (the launch blocker: nothing reviewed is visible).
- Edit product and variants: price, pack, stock, hazard class, dilution guidance, SEO fields.
- **CSV import**: upload, parse, show a diff (new, changed, unchanged, error per row), then apply in
  one transaction. Export the same shape so a round trip is lossless. This is how the PO corrects the
  catalogue, so the diff view matters more than the upload.
- Images and documents to Vercel Blob (ADR to record), linked to products.

### C. Orders and money
Search and filter; status changes through `OrderService` so every one stays evented; manual payment
recording (finance); refunds and credit notes (`Invoice` type `CREDIT_NOTE`, which the credit position
already nets off); invoice regeneration from the stored snapshot.

### D. Customers
View, approve credit (already in the credit service), set price list, notes, membership list.

### E. Merchandising and content
Promotions and coupons against the existing rule fields, delivery zones, content pages, homepage hero
and featured categories, review moderation, leads inbox, and a readable audit-log view.

## Order of work
1. Seam, shell, dashboard, and the authorisation test that iterates the registry.
2. Catalogue with CSV import and export.
3. Orders, refunds, manual payments.
4. Customers, merchandising, content, audit log.

## Decisions to record
- ADR: Vercel Blob for uploads (single vendor already in the stack; R2 adds a credential and a CORS
  surface for no gain at this volume).
- ADR: admin mutations go through one audited seam rather than per-route checks.
