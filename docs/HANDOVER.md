# Safuney website — handover

**Updated:** 2026-11-09. First written 2026-09-10 after nine phases, a brand pass and the real
catalogue.

This is the one page to read. Everything else is linked from it.

## Where things stand

**Live on Vercel today** (https://safuney-website-2026.vercel.app, not indexed by Google):

- The storefront, laid out on alliancechemical.com (the directors' benchmark) with Safuney's own
  words, photographs and colours. See [`decisions/0017-the-storefront-sells.md`](./decisions/0017-the-storefront-sells.md)
  and [`decisions/0016-the-real-brand.md`](./decisions/0016-the-real-brand.md).
- A production database (Neon, `safuney-db`) seeded with the 76-product, 102-pack catalogue, and a
  separate preview database with demo data for trying pull requests.
- Email through the cPanel mailbox `no_reply@safuney.com`: customer sign-in codes and links work.
- One administrator account (`admin@safuney.com`), created with `create-admin`.

**Built, waiting to be merged** (PRs #17–#26, all checks green, tried together on a test branch):

| PR | What it does |
| -- | ------------ |
| #25 | Security: a customer sign-in code or link never opens a staff account |
| #17 | Staff change their own password and authenticator; older sessions end |
| #24 | An administrator can reset a staff member's sign-in |
| #19 | The demo seed refuses a database with real staff accounts |
| #20 | Stock is checked again before payment, so nobody pays for packs already sold |
| #23 | The "payment received" message always goes out, exactly once |
| #21 | Orders placed as a guest appear in the account after sign-in |
| #26 | One account for email and phone: new contacts need a code, duplicates merge |
| #22 | Staff menu of desks, the right landing page per role, a new-order email to staff |
| #18 | Old safuney.com addresses redirect to the new pages; `SITE_INDEXABLE` lifts noindex |

Merge order: #25 → #17 → #24 → #21 → #26 → #22 → #23 → #18, #19, #20 in any order. Once #17 is in,
#22 and #26 each show a small conflict, and the developer updates those branches.

**Not live yet:** prices, real payments, SMS, and the domain. The steps below cover them.

## Road to launch, step by step

Do these in order. Each one says who it's waiting on.

### 1. Merge the open pull requests (repository owner)
In the order above. Then, against the production database:
`pnpm --filter @safuney/db clear-unverified-contacts`. It removes any email or phone the old profile
form saved without a code, and only reports unless run with `--apply`.

### 2. Prices, pack sizes and VAT (manager)
Every pack reads **"Price on request"** and offers a quote, because the catalogue has no prices. The
cart refuses to sell an unpriced pack on purpose.

- Send the manager `Safuney-price-list.xlsx`: all 102 packs, with yellow cells for price, VAT, stock,
  made to order and whether to sell online. It also asks whether the prices include VAT. The site
  stores prices **excluding** VAT and adds 16% at checkout.
- **38 products have no pack size** in the catalogue (SAF BACTOSAN, LIMEKLIN and others) and show
  "Pack size on request". The sheet asks for those too.
- The developer converts the returned sheet into the catalogue import file. Staff then load it at
  `/admin/catalogue` → **Import CSV**, read the changes, and confirm. See
  [`runbooks/catalogue-import.md`](./runbooks/catalogue-import.md).

### 3. Safety data sheets (manager)
**No product carries a hazard class.** The catalogue names caustics, acids, chlorine donors and
peroxides, but a hazard mark is a safety claim, so it comes only from Safuney's safety data sheets.
Send those and the marks, storage warnings and compliance library fill in.

### 4. Company details (manager)
- `/admin/settings`: **KRA PIN** and **VAT number**. Tax invoices issue without them, but that is not
  KRA-compliant.
- `apps/web/config/site.ts`: **opening hours** (not shown anywhere yet) and the **WhatsApp number**
  (0796 808 822, not yet confirmed). The catalogue prints "P.O BOX 34079 - 0100"; the site shows
  **00100**, the Nairobi GPO code. Correct it if that's wrong.
- **Delivery fees** per area, and the **M-Pesa Paybill or Till number**.
- **Which inbox gets new-order alerts**: set `ORDERS_INBOX` in Vercel (default `info@safuney.com`).

### 5. Staff accounts and handing over admin (developer + owner)
- Hand the administrator role to the business owner on a call. Run
  `pnpm --filter @safuney/db create-admin <their email> "<name>"`. They type the key into the
  authenticator app on their own phone, then change the password at **My account → Security** (#17),
  so nobody else knows it.
- Decide what happens to the developer's `admin@safuney.com`: a lower role, or switched off.
- Everyone else is created by the owner at `/admin/staff`, one account per person. A lost phone or
  password is reset there too (#24).

### 6. Email and SMS (developer + whoever holds cPanel)
- **DMARC record: added 2026-11-09** with `p=none` (reports only). Around 2026-11-23, read the reports
  and move to `p=quarantine`, as described in [`runbooks/email-dns.md`](./runbooks/email-dns.md).
- **SMS** (sign-in codes by text, delivery updates, failed-payment alerts): an Africa's Talking
  account with `AT_USERNAME`, `AT_API_KEY` and an approved `AT_SENDER_ID`. The sender ID needs
  approval from the networks, which can take a while, so apply early.

### 7. Security settings in Vercel (developer)
- **Upstash Redis** for rate limiting (`KV_REST_API_URL` and `KV_REST_API_TOKEN`, from Vercel →
  Storage). Without it, the limit on guessing sign-in codes is kept per server and is much weaker.
- `AUTH_SECRET` set separately for Production and Preview (Preview has its own since 2026-10-27;
  confirm Production's is not the same).
- After the database password reset on 2026-10-23, confirm Production's `DATABASE_URL` holds the new
  one.
- **Backups:** check how far back the Neon plan can restore, and note it here. That is how far back
  a bad import or a mistaken delete can be undone.

### 8. Payments live (developer, with the owner's accounts)
Daraja production credentials and Paystack live keys, with callback URLs on the final domain. See
section 3 of [`runbooks/launch.md`](./runbooks/launch.md). Place one small real payment for each
method, then refund it.

### 9. A full test order on the preview (anyone)
Place it, pay it, pick it, dispatch it, deliver it. Check every email and SMS arrives, including the
staff alert and the customer receipt.

### 10. The Vercel plan (Vercel team owner)
The team is on a **Pro trial**. The Hobby plan is for non-commercial use only, so a shop needs Pro.
Decide before the trial ends, or the project is downgraded on its own.

### 11. Domain cut-over (on the owner's word)
DNS for safuney.com is in **cPanel's Zone Editor**, because the domain uses the host's nameservers.
Only the website's `A` and `www` records change. **Leave the nameservers and every mail record alone**,
or all safuney.com email stops. Exact steps: section 1 of [`runbooks/launch.md`](./runbooks/launch.md).

### 12. Turn on indexing (last)
`SITE_INDEXABLE=1` on Production, only after prices are in and the domain has moved. Google indexes
whatever price is showing when you flip it. Then submit the sitemap in Google Search Console.

### Also worth doing
- **Data protection registration.** Kenya's Data Protection Act requires many businesses that handle
  customer data to register with the Office of the Data Protection Commissioner (ODPC). Check whether
  Safuney's size and sector require it. The site already offers data export and deletion.
- **Have a native speaker read the Swahili** in `apps/web/lib/i18n/messages.ts`.
- **Sentry** for error alerts: needs an account and a DSN. Until then, `vercel logs --follow`.

## What is waiting on a credential

| Thing | Needs | Without it |
| ----- | ----- | ---------- |
| Emails to customers, sign-in codes | `SMTP_*` (the cPanel `no_reply@` mailbox) or `RESEND_API_KEY` | Site works, sends nothing — customers hear silence after paying |
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
| **[`runbooks/email-dns.md`](./runbooks/email-dns.md)** | Adding the DMARC record in cPanel |
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

- **The planner's consumption figures are estimates** derived from coverage at stated dilutions and
  standard frequencies, not from Safuney's own data. The page says so. Check them against a site you
  know before switching that feature on.
- **The Swahili is mine, not a native speaker's.** It is Kenyan commercial Swahili as I understand it —
  "oda", "lipa", loanwords where the loanword is what people say. One file,
  `apps/web/lib/i18n/messages.ts`. Have someone read it.
- **Contacts saved before #26 were never checked.** A sign-in with one still opens the account it was
  typed into. `clear-unverified-contacts` (road to launch, step 1) removes them; no new ones can be
  created.

## If you want to hand this to another developer

`docs/runbooks/setup-windows.md` gets a machine running. `docs/decisions/` explains every non-obvious
choice and what was rejected. `docs/reports/` is the history, phase by phase, including the mistakes and
what they cost. Start them there rather than in the code.
