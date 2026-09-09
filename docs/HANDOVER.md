# Safuney website — handover

**Date:** 2026-09-09 · Nine phases, eleven pull requests, all merged to `main`.

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

### 1. Correct the catalogue — only you can do this
The products on the site were harvested from the old site because it could not be fetched directly.
Names, pack sizes and prices are all provisional. **Anything still marked "needs review" is invisible to
customers** — that is the safety net, and it means the shop currently shows less than it will.

Go to `/admin/catalogue` → **Export CSV** → fix it in a spreadsheet → **Import CSV** → read the diff →
publish. Full instructions, including the Excel traps that actually bite:
**[`runbooks/catalogue-import.md`](./runbooks/catalogue-import.md)**

### 2. Company details
`/admin/settings`: **KRA PIN** and **VAT number**. Tax invoices already issue; until these are set they
issue without the seller's identifiers, which is not KRA-compliant.

`apps/web/config/site.ts`: confirm the address, phone, WhatsApp and email. Every one is currently marked
unconfirmed, which is why the site asserts none of them to Google as fact — so Safuney does not appear
in local search results until you confirm them. Opening hours are not on the site at all, because nobody
has told me what they are.

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

- **An order whose 30-minute stock hold expired can still be paid** without re-checking stock. Rare, and
  it would oversell by one order. Fixing it properly means re-validating at payment time, which is a
  change to the callback path I did not want to make without you watching.
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
