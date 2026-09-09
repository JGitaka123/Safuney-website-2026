# 0006 — Payment provider abstraction and how Daraja callbacks are trusted

**Status:** accepted · **Date:** 2026-09-09

## Decision
`packages/payments` defines one `PaymentAdapter` interface (`initiate`, `parseCallback`, `queryStatus`,
`isConfigured`) with adapters for Safaricom Daraja (STK push, status query, C2B), Paystack (cards),
invoice and cash on delivery, plus a `MockAdapter` used when `PAYMENTS_MODE=mock` (previews and CI
only; production refuses). Checkout and the order service depend only on the interface, so a Pesapal
adapter can be added without touching either.

Every callback goes through `OrderService.handleCallback`: the adapter verifies and parses it, the
`WebhookEvent.eventKey` unique index makes replays a no-op, and a "successful" callback whose amount
does not match the payment's amount is recorded as a mismatch and never marks the order paid.

## Daraja has no signature
Safaricom callbacks are plain JSON with no HMAC. Three checks stand in for one:
1. the callback URL carries a secret path segment (`MPESA_CALLBACK_SECRET`) that only we and Safaricom see;
2. in production the source IP must be in Safaricom's published callback range;
3. the `CheckoutRequestID` must match a payment we initiated, and the amount must match the order.
Daraja rounds to whole shillings, so an overpayment of less than one shilling is accepted; anything else
is a mismatch.

## Paystack
Webhook signature is HMAC-SHA512 of the raw body with the secret key, compared in constant time; the
verify endpoint is also used when the customer returns from the card page before the webhook lands.

## Stock
Placing an order reserves stock inside the same transaction that creates it (row locks + CHECK
constraints). A paid callback converts the reservation into an outbound movement. Unpaid orders release
their reservation after 30 minutes (Vercel cron every 10 minutes). Made-to-order packs reserve only what
exists.

## Consequences
- Sandbox and live credentials are environment variables only (runbook §6, §9).
- Payment attempts per order are capped at 5; after that the customer is asked to call.
- Invoice payment is refused until a customer has an approved credit account (Phase 4).
