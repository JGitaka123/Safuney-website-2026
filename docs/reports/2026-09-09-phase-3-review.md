# Phase 3 review — gaps found in the checkout PR and how they were closed

**Date:** 2026-09-09 · **Reviewed:** PR #4 (`main` at 2a5f712) · **Fix branch:** `claude/funny-thompson-2lukly`

George's Phase 3 landed the payments package, the order service and a working four-step checkout.
This review checked it against the brief's non-negotiables and the design plan, then closed the gaps.

## What was wrong

| # | Gap | Why it matters | Fix |
| --- | --- | --- | --- |
| 1 | Lighthouse LCP gate relaxed from 2000 ms to 2500 ms | Non-negotiable #7 is LCP < 2.0 s on key pages; the gate was moved instead of the pages | Gate restored to 2000 ms; the pages were made faster (below) and Lighthouse now measures with real throttling (ADR 0007) |
| 2 | "Pay another way" on the M-Pesa pending screen sent the customer back to the payment step of a cart that had already been consumed by the order | Second order, or a dead end | New `switchPaymentMethod` on the order service: the same order changes method (M-Pesa ↔ card ↔ cash on delivery), keeps its stock reservation and appends an event; available from the pending screen and the tracking page |
| 3 | The report claimed Playwright coverage of COD, M-Pesa success, cancel + retry and card return; the spec only reached the review step | Payment outcomes were unverified in CI | Mock test controls (server-gated to `PAYMENTS_MODE=mock`) feed signed callbacks in; 9 checkout journeys now run on mobile and desktop: validation, COD → tracking, M-Pesa success, M-Pesa cancel → retry → switch to COD, card success, card cancel → tracking → switch, keyboard-only, empty cart, token-required tracking |
| 4 | Retry after a cancelled M-Pesa prompt left the order in `PAYMENT_FAILED`, so the pending screen showed the old failure straight away | Customer could not retry | `initiatePayment` moves a failed order back to `PENDING_PAYMENT` and extends the reservation; integration test extended |
| 5 | Pay button and order summary showed the cart total without the quoted delivery fee | The button promised a smaller charge than the order placed | `quoteDeliveryAction` returns the grand total; button, summary, M-Pesa prompt and tracking page all show it |
| 6 | Payment step offered card even when Paystack is not configured, and defaulted to M-Pesa even when Daraja is not; invoice copy invented "30-day credit terms" | Dead ends and a made-up commercial term | Options are disabled with the server's reason; default is the first available method; invoice copy states only what is true (approved credit accounts, Phase 4) |
| 7 | Copy leaked infrastructure ("The server is the authoritative price source", "Secure checkout" in mono, "Reserving stock & initiating order…", event badges like `[PENDING_PAYMENT]`, "Payment cancelled by user") | Design plan §3: no template tells, no internal vocabulary | Rewritten in the brand voice; event statuses shown as sentences |
| 8 | Horizontal overflow at 360 px on the delivery step (418 px), payment step (366 px) and tracking page (521 px) | Mobile-first is non-negotiable | Grid children `min-w-0`, wrapping button rows, stacked item list on small screens, phone number no longer breaks |
| 9 | M-Pesa phone field was nested inside the radio's `<label>`, so the radio's accessible name included the field and the field's label was ambiguous | WCAG 2.1 AA (name, role, value) | Field moved out of the label with its own accessible name |
| 10 | Tracking page breadcrumb read "Home / Home / Orders"; order number wrapped across three lines on desktop | Polish | Fixed |
| 11 | Card return URL depended on `NEXT_PUBLIC_SITE_URL`, unset in CI | Card journeys could not run in CI | CI sets it to the Playwright base URL |
| 12 | The catalogue facet test relied on the filter sheet staying open after navigation, which is a race | Flaky test | Test reopens the sheet before asserting |

## Performance work (all pages)
Lighthouse's simulated mode reported 2.0–2.4 s LCP for pages whose measured LCP is 1.7–1.9 s (see ADR
0007 for the mechanism). Rather than move the gate, the pages were made lighter and the measurement
made faithful:

- Sans 600 preloaded as a file instead of inlined in the stylesheet: render-blocking CSS 27 KB → 9 KB.
- Mono subset to the core range: 15 KB → 8 KB.
- `Sheet` rebuilt on the native `<dialog>`; `@radix-ui/react-dialog` removed: −15 KB JS on every page
  (ADR 0007).
- `sideEffects: false` on the workspace packages so unused primitives tree-shake.
- Lighthouse: `throttlingMethod: "devtools"`, three runs, `/checkout` added to the page list.

Page weight on the product page went from 283 KB to 245 KB; first contentful paint in the mobile profile
from 1.2 s to 0.9 s.

## Verified
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (102 unit and integration tests), production build,
  placeholder guard, money guard.
- Playwright + axe: 87 tests on the mobile and desktop projects, all green, including the nine
  checkout journeys and the three sheets on the native dialog.
- Lighthouse (mobile profile, DevTools throttling, best of 3 runs; local container, see the PR checks
  for the CI numbers):

| Page | Performance | Accessibility | Best practices | SEO | LCP (best of 3) | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 98 | 100 | 96 | 100 | 1.75 s | 0 |
| `/products` | 97 | 100 | 96 | 100 | 1.65 s | 0 |
| `/products/disinfection` | 96 | 100 | 96 | 100 | 1.73 s | 0 |
| product page | 97 | 100 | 96 | 100 | 1.86 s | 0 |
| `/cart` | 97 | 100 | 96 | 100 | 1.61 s | 0 |
| `/checkout` | 97 | 100 | 96 | 100 | 1.63 s | 0 |
| `/contact` | 97 | 100 | 96 | 100 | 1.69 s | 0 |

Run-to-run spread with real throttling is about ±50 ms (the simulated model gave 1.7–2.4 s for the same
pages).

- Screenshots at 360 px and 1280 px of every checkout step, the pending, cancelled and switch states,
  the tracking page and the sheets: no horizontal overflow at any step.

## Still not verified
- Real Daraja and Paystack sandbox payments (no credentials supplied; questions 13–14).
- The Vercel preview itself (this container cannot reach `*.vercel.app`); the preview-smoke workflow
  runs on `deployment_status`.

## PO actions needed
Unchanged from the Phase 3 report: Daraja sandbox app and `MPESA_*` on Preview; Paystack test keys and
webhook URL; answer question 8 (delivery zones and fees); one real STK push on a preview.
