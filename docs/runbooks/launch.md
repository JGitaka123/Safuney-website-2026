# Launch runbook

**For:** whoever is at the keyboard on cut-over day, and whoever is woken at three in the morning
afterwards. Written to be followed, not read.

Nothing in this file happens without the PO's explicit go-ahead. The DNS change in particular is
irreversible for as long as it takes DNS to propagate, and it is his call.

---

## 0. Before you start — the gate

Do not begin until **all** of these are true. Each has cost someone a launch somewhere.

| # | Check | How to confirm |
| - | ----- | -------------- |
| 1 | The catalogue is corrected and reviewed | `/admin/catalogue?filter=needs-review` shows **0 products**. Anything still flagged is invisible to customers, and turning on indexing publishes whatever is *not* flagged — at whatever price it currently carries. |
| 2 | Company KRA PIN and VAT number are set | `/admin/settings`. Tax invoices already issue; without these they issue without the seller's identifiers, which is not KRA-compliant. |
| 3 | Real staff accounts exist | `/admin/staff`. The demo accounts (`admin@safuney.test` and friends) exist only where `SEED_DEMO=1`, which is never production — but confirm the real people can sign in **before** you need them to. |
| 4 | `AUTH_SECRET` is set in Vercel, different for Production and Preview | `openssl rand -base64 32`. Sharing one between environments means a preview session is a production session. |
| 5 | Payment credentials are live, not sandbox | Section 3 below. |
| 6 | Email and SMS are configured | `RESEND_API_KEY` with a verified domain; Africa's Talking key and sender ID. Without them the site still works and simply sends nothing — which customers experience as silence after paying. |
| 7 | A test order has gone all the way through on the preview | Place it, pay it, pick it, dispatch it, deliver it. Confirm the emails and SMS arrived. |

---

## 1. Domain cut-over

**Only on the PO's instruction.** Ask which registrar holds `safuney.com` before you begin; you will
need access to its DNS panel.

```bash
vercel domains add safuney.com          # on the safuney-website-2026 project
vercel domains add www.safuney.com
vercel domains inspect safuney.com      # READ the records it prints — do not use the ones below from memory
```

Vercel prints the exact records. At the time of writing they are usually an `A` record to
`76.76.21.21` for the apex and a `CNAME` to `cname.vercel-dns.com` for `www`, **but read them from
`vercel domains inspect` rather than trusting this sentence** — they change, and a wrong record is a
site that is down rather than a site that is slow.

Give the PO the records exactly as printed. Then:

1. Wait for Vercel to show both domains as **Valid Configuration**. This can take minutes or hours
   depending on the registrar's TTL.
2. Confirm SSL is issued (Vercel does this automatically once DNS resolves). Do not proceed on a
   certificate warning.
3. Choose the canonical host — apex or `www` — and set the other to redirect 301. The PO's choice;
   apex is the default here because that is how the brand is written.
4. Set `NEXT_PUBLIC_SITE_URL=https://safuney.com` in Vercel **Production**. Everything canonical,
   every sitemap URL and every payment callback URL derives from it.

### Old URLs
Map every URL from the Phase 0 inventory to its new address with a 301, so no inbound link and no
search ranking is lost. A 404 on an old URL is a ranking thrown away.

---

## 2. Turn on indexing — the last step, not the first

```
SITE_INDEXABLE=1     # Vercel → Production only
```

Until this is set, `robots.txt` blocks every crawler and the sitemap is deliberately empty (ADR 0002,
updated in Phase 7). Three conditions must all hold before anything is indexed: production, this flag,
and a site URL that is not a `*.vercel.app` host. A preview can never be indexed whatever the flag says.

**Do not set this before the catalogue is corrected.** Google will index a provisional price, and
getting it re-crawled is slower than getting it indexed.

Then submit `https://safuney.com/sitemap.xml` in Google Search Console.

---

## 3. Payments go live

### M-Pesa (Daraja)
1. In the Safaricom developer portal, move the app from sandbox to **production**: new consumer key and
   secret, the real **shortcode**, and the **passkey** for that shortcode.
2. Register the callback URL **against the production domain**:
   `https://safuney.com/api/payments/mpesa/callback`
   Daraja will not call a URL it has not been told about, and it will not call `http`.
3. Set in Vercel Production: `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, `DARAJA_SHORTCODE`,
   `DARAJA_PASSKEY`, `DARAJA_ENV=production`.
4. Set `PAYMENTS_MODE=live`. **The registry refuses to run mock mode in production**, so a
   misconfiguration here fails loudly rather than quietly accepting fake payments.
5. Place one real order for a small amount and confirm the money arrives and the order goes to PAID.
   Then refund it out of band.

### Card (Paystack)
1. Live public and secret keys from the Paystack dashboard.
2. Register the webhook: `https://safuney.com/api/payments/paystack/callback`
3. Set `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` in Vercel Production.
4. One real card payment, then refund.

### Cash on delivery
Confirm the M-Pesa Paybill or Till number riders collect against is the one in the warehouse
instructions, and that whoever reconciles it knows to look for the reference the warehouse records.

---

## 4. Monitoring

| What | Where | Set up by |
| ---- | ----- | --------- |
| Real-user performance | Vercel Speed Insights (already wired) | Done |
| Errors | Sentry — **needs a DSN from the PO** | Blocked |
| Failed payments | `/admin` overview tile, and `/admin/orders?filter=payment-failed` | Done |
| Failed-payment alerts to a phone | Needs the Africa's Talking key | Blocked |
| Webhook forgery attempts | `WebhookEvent` rows with `signatureOk = false` | Done |

Until Sentry exists, `vercel logs --follow` on the production deployment is the fallback. Say so out
loud rather than assuming someone knows.

---

## 5. Rollback

Vercel keeps every deployment. To go back:

```bash
vercel ls safuney-website-2026            # find the last known-good deployment
vercel promote <deployment-url>           # instant; no rebuild
```

**What a rollback does not undo:** database migrations. Every migration in this project is additive
(new tables, new nullable columns, new indexes) precisely so that a rollback of the application does
not strand the database — but check `packages/db/prisma/migrations/` before assuming it of a migration
written after this file.

If a rollback is needed because of a payment problem, **switch the affected method off first**
(`/admin/settings` or by clearing its credentials) so no further customer is taken through a broken
flow while you work.

---

## 6. The first seven days

A daily one-line report to the PO, at the same time each day:

```
Safuney day N — <orders> orders, <KES> taken, <failed> failed payments, <errors> errors, LCP p75 <x>s
```

Where to get each: orders and money from `/admin`; failed payments from the same page; errors from
Sentry once it exists, or `vercel logs` until then; LCP from Vercel Speed Insights.

Watch specifically for:
- **Failed payments clustering on one method.** One is a customer; five in an hour is a configuration
  problem or a provider incident.
- **Orders stuck in PENDING_PAYMENT.** Stock is released automatically after 30 minutes, but a pile of
  them means the callback is not arriving — check the registered callback URL first.
- **`WebhookEvent` rows with `signatureOk = false`.** Someone is trying it on. It is expected at a low
  rate; a spike is worth looking at.
- **Anything in the audit log nobody can account for.**
