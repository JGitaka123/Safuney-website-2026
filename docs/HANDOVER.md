# Safuney website — handover

**Date:** 2026-09-10 · Nine phases, plus a brand pass and the real catalogue.

**Latest change:** the storefront was rebuilt to sell — a picture-and-numbers home page, a free site
survey offer, WhatsApp and a quote button always in reach, and short copy throughout. The 76-product
catalogue now shows on production even without a database (a snapshot compiled from the catalogue
files), and enquiry forms hand the request to WhatsApp instead of failing when there is nowhere to send
it. See [`decisions/0017-the-storefront-sells.md`](./decisions/0017-the-storefront-sells.md). The site's
own material — logo, colours, strapline, range and photography — is from `PRODUCT CATALOGUE JULY 2024`
([`decisions/0016-the-real-brand.md`](./decisions/0016-the-real-brand.md)).

**Production today has no database and no email key** (only `NEXT_PUBLIC_SITE_URL` is set in Vercel).
The catalogue and WhatsApp enquiries work regardless; online ordering, stored quotes and emailed leads
start working once `DATABASE_URL` is set and seeded (`pnpm --filter @safuney/db seed`) and
`RESEND_API_KEY` is added. Two commercial switches in `apps/web/config/site.ts` need a director's
word: `offer` (the free site survey, on) and `clients` (customers named on the site, empty until they
agree in writing).

This is the one page to read. Everything else is linked from it.

---

## What exists

A production Next.js shop for Safuney Limited: catalogue with colour-coded cleaning zones and dilution
guidance, cart and checkout with M-Pesa, card, cash on delivery and invoice, corporate accounts with
approval thresholds and credit terms, quotes, a warehouse fulfilment board, a customer account with
data export and deletion, an admin console, and eight optional features behind switches you control.

**Production:** https://safuney-website-2026.vercel.app
It is **not indexed by Google**, deliberately, and will not be until you say so (see step 5 below).

## The three things standing between this and launch

Everything else is optional. These are not.

### 1. Prices — only you can do this
The catalogue you sent has everything except prices, so every pack currently reads **"Price on
request"** and offers a quote instead of a Buy button. The cart refuses to sell an unpriced pack; that
is deliberate, and it is the one thing keeping the shop from trading.

Go to `/admin/catalogue` → **Export CSV** → put the prices in a spreadsheet → **Import CSV** → read the
diff → publish. Full instructions, including the Excel traps that actually bite:
**[`runbooks/catalogue-import.md`](./runbooks/catalogue-import.md)**

Two things in the same file need your eye while you are there:

- **17 chemicals have no pack size**, because the catalogue never states one (SAF BACTOSAN, LIMEKLIN,
  PRIMA RESHINE and the rest — the full list is question 15 in
  [`discovery/questions-for-po.md`](./discovery/questions-for-po.md)). They show "Pack size on request".
- **Nothing carries a hazard class.** The catalogue names caustics, acids, chlorine donors and
  peroxides, but a hazard mark is a safety claim and we will only take it from your safety data sheets.
  Send those and the marks, storage warnings and compliance library populate themselves.

### 2. Company details
`/admin/settings`: **KRA PIN** and **VAT number**. Tax invoices already issue; until these are set they
issue without the seller's identifiers, which is not KRA-compliant.

`apps/web/config/site.ts`: the address, the three phone lines and the email now come from page 16 of
your catalogue and are marked confirmed, so the site does assert them to Google. Two things are still
open: **opening hours** (not on the site at all, because nobody has told me what they are) and the
**WhatsApp number**, which currently falls back to the first phone line. The catalogue prints
"P.O BOX 34079 - 0100"; the site shows **00100** on the assumption that is the Nairobi GPO code —
correct me if not.

### 3. Real staff accounts
`/admin/staff`. Each person gets their own; the authenticator code shows **once**, at creation, and
cannot be recovered. The demo accounts exist only where the demo seed runs, which is never production.

## Then, in this order

4. **Payments live.** Daraja production credentials and Paystack live keys, and the callback URLs
   registered against the final domain. Step 3 of
   **[`runbooks/launch.md`](./runbooks/launch.md)**.
5. **Domain cut-over**, on your instruction. Tell me which registrar holds `safuney.com` and I will give
   you the exact DNS records to add. Step 1 of the launch runbook.
6. **Turn on indexing** — `SITE_INDEXABLE=1` on production, and not before step 1 is done. Google will
   index whatever price is showing when you flip it.

## What is waiting on a credential

| Thing | Needs | Without it |
| ----- | ----- | ---------- |
| Emails to customers | `RESEND_API_KEY` + verified domain | Site works, sends nothing — customers hear silence after paying |
| SMS to customers | Africa's Talking key + sender ID | Same |
| Product advisor | `ANTHROPIC_API_KEY` | The page routes the question to your team instead |
| Error monitoring | Sentry DSN | `vercel logs --follow` is the fallback |
| Failed-payment alerts to a phone | Africa's Talking key | The `/admin` tile only |
| Image and document uploads | Vercel Blob store + token | Photos and SDS files stay links |
| Semantic search | `pgvector` on the database, Voyage key | The existing search (full-text + typo tolerance) |
| WhatsApp ordering | Meta business account, verified number | Not built |

## One CI signal you should not trust

The **preview smoke** job reports success without testing anything. Vercel Deployment Protection blocks
its requests, so every step skips and the job goes green. Either turn off Vercel Authentication for
previews, or add `VERCEL_AUTOMATION_BYPASS_SECRET` as a GitHub secret. Flagged since Phase 4.

Every other check is real: lint, typecheck, build, no-placeholder-text, money-is-always-integer,
Swahili-catalogue-complete, 177 browser tests with accessibility checks, and Lighthouse ≥ 95 on mobile.

## Where things are

| Document | What it is for |
| -------- | -------------- |
| **[`runbooks/admin-guide.md`](./runbooks/admin-guide.md)** | For your staff. No technical knowledge assumed |
| **[`runbooks/catalogue-import.md`](./runbooks/catalogue-import.md)** | The spreadsheet round trip |
| **[`runbooks/launch.md`](./runbooks/launch.md)** | Cut-over day, and the seven days after |
| **[`runbooks/setup-windows.md`](./runbooks/setup-windows.md)** | Getting a developer machine running |
| `decisions/` | Fourteen ADRs — why things are the way they are, and what was rejected |
| `reports/` | One report per phase: what shipped, what did not, and the risks |
| `discovery/questions-for-po.md` | The questions still open |
| `load/README.md` | The k6 load test and how to read it |

## The rules this site is built on

These are enforced, not aspirational. Each has a test that fails if it is broken.

1. **The server decides prices.** The browser never sends one. A cart held open while a price changes
   gets the new price.
2. **Money is whole cents, never a decimal.** A guard script fails the build if a money field is ever
   declared as a float.
3. **Stock cannot go negative.** Enforced in the database, tested under concurrent orders.
4. **Payment callbacks are signature-verified and idempotent.** A replay changes nothing; a short
   payment never marks an order paid; forgery attempts are recorded.
5. **Every order state change is an append-only event**, with who did it.
6. **No placeholder text ships.** A guard scans the built output.
7. **Nothing unreviewed reaches a customer** — or Google.

## Known limitations, stated plainly

- **An order whose 30-minute stock hold expired can still be paid** without re-checking stock, if
  somebody else bought the packs in between. Stock never goes negative — that guarantee holds — but the
  customer has paid for more than we can ship. The order is now flagged with a `stock_shortfall` event
  carrying the SKU and the numbers, so the warehouse is told rather than finding out at the pick face,
  and somebody decides whether to part-ship, back-order or refund. Preventing it outright means
  re-validating stock inside the payment callback, which is a change to the money path I would rather
  make with you watching than slip in at the end.
- **The planner's consumption figures are estimates** derived from coverage at stated dilutions and
  standard frequencies, not from Safuney's own data. The page says so. Check them against a site you
  know before switching that feature on.
- **The Swahili is mine, not a native speaker's.** It is Kenyan commercial Swahili as I understand it —
  "oda", "lipa", loanwords where the loanword is what people say. One file,
  `apps/web/lib/i18n/messages.ts`. Have someone read it.
- **Product photography does not exist.** Share cards are generated from each product's name, zone and
  pack sizes so a link pasted into WhatsApp still looks like Safuney.

## If you want to hand this to another developer

`docs/runbooks/setup-windows.md` gets a machine running. `docs/decisions/` explains every non-obvious
choice and what was rejected. `docs/reports/` is the history, phase by phase, including the mistakes and
what they cost. Start them there rather than in the code.
