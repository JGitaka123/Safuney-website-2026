# Phase 4 plan — B2B accounts, approvals, price lists, quotes, credit

**Date:** 2026-09-09 · **Status:** built; see `docs/reports/2026-09-09-phase-4.md` · Spec: master prompt §6 Phase 4, §2 stack (auth), §5 data model.

## Scope (from the brief)
1. Organisation accounts: multi-user (buyer, approver), approval workflow above a threshold, PO number on
   orders, customer-specific price lists, credit limit and terms, statement of account, tax invoice
   download, saved reorder lists, one-click reorder from history, scheduled deliveries.
2. Request-for-quote for large or uncatalogued needs; sales prices it; customer accepts → order.
3. Credit-account onboarding (company documents, KRA PIN, trade references) → approval.
4. Gate: approval-workflow tests, credit-limit enforcement tests.

## Prerequisite: sign-in (stack §2)
Auth.js v5 (`next-auth@5 beta`, the App Router line; v4 targets the pages router) with the Prisma
adapter on the existing `User`/`Account`/`Session`/`VerificationToken` models.
- Customers: email magic link (Resend) and phone OTP (Africa's Talking SMS). Both providers degrade to
  a **console/mock provider** when the API key is absent (previews, CI): the link or code is written to
  the server log and, in `PAYMENTS_MODE=mock`, shown on the page so Playwright can complete the flow.
- Staff: email + password + TOTP (Phase 6 admin UI; the credential provider and TOTP check land now so
  the sales pricing screen can be protected).
- Roles from `UserRole`; organisation membership from `CustomerMember.role` (OWNER, BUYER, APPROVER).
- Cart merge on sign-in (`CartService.mergeInto`), header shows "Account" / "Sign in".
- Rate limiting on OTP and magic-link requests (existing `lib/rate-limit.ts`).

## Workstreams
### A. Accounts and organisations
- `/account`: profile, addresses, orders (history from Phase 3 orders keyed by user/customer), saved
  lists, subscriptions, credit and statement (organisation members only).
- Organisation creation from the account page or the credit application; owner invites members by
  email with a role; invitation accepted through sign-in.
- Pricing resolution: `PriceListItem` (best matching `minQty` ≤ qty) → falls back to list price. One
  function `resolvePrice(variant, qty, customer)` used by catalogue display (when signed in), cart
  totals and order placement — the server remains the price authority.

### B. Approval workflow and credit
- `Customer.approvalThresholdMinorUnits`: an order at or above it, placed by a BUYER, is created as
  `AWAITING_APPROVAL` (stock reserved, no payment initiated). Approvers see it under
  `/account/approvals`; approve → the order proceeds to payment (invoice: `CONFIRMED`; M-Pesa/card:
  `PENDING_PAYMENT` with initiation), reject → `CANCELLED` with the reservation released. Every step
  is an `OrderEvent` with `actorId`.
- Credit: `INVOICE` is available when `Customer.status = CREDIT_APPROVED` and the outstanding balance
  (sum of unpaid tax invoices) plus this order's total is within `creditLimitMinorUnits`. Enforced in
  `OrderService.placeOrder` inside the transaction; the refusal names the available credit.
- Tax invoice (`Invoice` TAX) issued when an invoice order is confirmed; pro-forma on request;
  `dueDate = issuedAt + creditTermsDays`. PDF rendered server-side (`@react-pdf/renderer`), stored in
  Vercel Blob when configured, otherwise generated on demand from the invoice snapshot.
- Statement of account: invoices, payments recorded by finance (Phase 6 records them; the model and
  page exist now), balance, overdue.

### C. Reorder, saved lists, scheduled deliveries
- Saved lists (`SavedList`): create from cart or order, add from product page, "Add all to cart".
- One-click reorder from an order: adds the order's lines to the cart with a per-line stock report.
- Scheduled deliveries (`Subscription`): interval, next run, items, address, payment method; a cron
  route creates the next order and emails a reminder three days before; pause/cancel from the account.

### D. Request for quote
- `/quote`: freeform lines or the current cart, contact details, notes, optional file; creates a
  `Quote` (`REQUESTED`) and a `Lead`.
- `/sales/quotes` (SALES/ADMIN roles): price lines, set validity, send; customer receives an email link
  to `/quotes/[number]?token=` to accept → converts to an order through `OrderService` with the quoted
  prices as an explicit price source (audited).

### E. Credit onboarding
- `/account/credit/apply`: legal name, KRA PIN, requested limit and terms, trade references, document
  upload (Vercel Blob when configured; otherwise the form accepts the details and tells the customer
  documents will be requested by email). Creates `CreditApplication` and moves the customer to
  `PENDING_CREDIT_APPROVAL`; approval UI is Phase 6, but the service method and its authorisation
  test land now.

## Order of work (one PR per slice where CI stays green)
1. Auth + account shell + cart merge + header (A, part).
2. Price lists + approval workflow + credit enforcement + invoices (A rest, B). Gate tests.
3. Saved lists, reorder, scheduled deliveries (C).
4. RFQ (D) and credit onboarding (E).

## Decisions recorded
- ADR 0008: Auth.js v5 on the App Router, JWT sessions, no customer passwords.
- File uploads were not built in this phase: the credit application takes document links (shared
  drive) and finance asks for files by email. Vercel Blob is the intended store when the admin console
  (Phase 6) adds uploads for products, documents and credit files; the decision is recorded there.
