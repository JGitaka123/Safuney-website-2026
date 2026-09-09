# Phase 5 plan — customer account, orders, delivery

**Date:** 2026-09-09 · **Status:** planned · Spec: master prompt §6 Phase 5.

## Scope (from the brief)
1. Account: order history with the `OrderEvent` timeline, tracking, reorder, invoices, addresses,
   saved payment preferences (never card data), subscription management, data export, account
   deletion.
2. Warehouse view: pick list per order, mark packed and dispatched, assign rider, proof of delivery
   (photo + name), cash-on-delivery collection with the M-Pesa reference.
3. Notifications: email and SMS on paid, packed, dispatched, delivered (WhatsApp in Phase 8).

## Already in place from Phases 3–4
Order tracking page and event timeline, one-click reorder, saved lists, invoices and statement,
scheduled deliveries (subscriptions) with skip/pause/resume/cancel, sign-in, organisation accounts.
Phase 5 fills in what is missing around them.

## Workstreams
### A. Account
- `/account/orders/[number]`: the tracking page for a signed-in owner without the token, with the
  same timeline; `/account` lists all orders with filters (status, date) and pagination.
- Address book (`Address`): add, edit, default, delete; used by checkout (pick an address) and by
  scheduled deliveries (so they can be delivered, not only collected).
- Payment preference: default method (M-Pesa number, cash on delivery, invoice) on the customer;
  no card details ever stored (Paystack tokens are not kept either).
- Profile: name, email, phone; link a phone to an email account (the Phase 4 risk); marketing
  opt-in with a timestamp (DPA).
- Data export (JSON of the customer's profile, addresses, orders, invoices, lists, schedules) and
  account deletion (anonymise personal data on orders and invoices that must be kept for tax; delete
  the rest; audit-logged) per Kenya DPA 2019.

### B. Warehouse
- `/warehouse` (WAREHOUSE, ADMIN): orders to pick (PAID/CONFIRMED), packing (PACKED), out for
  delivery (DISPATCHED); a pick list per order stored on `Fulfilment.pickListJson` and printable.
- Transitions through `OrderService`: `markPacked`, `dispatch(rider)`, `markDelivered(pod)`,
  `recordCodCollection(amount, mpesaRef)`; each an `OrderEvent` with actor; stock moves from reserved
  to out at dispatch (`InventoryMovement` OUT); COD collection creates a `Payment` row.
- Proof-of-delivery photo: Vercel Blob when configured (the first upload use case; ADR 0009).
- Gate: authorisation tests (customers and sales cannot call warehouse mutations) and inventory tests
  (dispatch decrements on hand and reserved exactly once).

### C. Notifications
- `lib/notify.ts` gains `notifyOrderStatus(order, status)`: templates for paid, packed, dispatched
  (with rider name and phone), delivered; email via Resend, SMS via Africa's Talking, both skipped
  cleanly when not configured; a `Notification` log table (migration) so nothing is sent twice.
- Approval outcomes from Phase 4 (approved / not approved) and quote events go through the same
  channel.

## Order of work
1. Address book + checkout integration + scheduled deliveries to an address.
2. Warehouse view and transitions with tests; notifications on each transition.
3. Profile, payment preference, export, deletion.
