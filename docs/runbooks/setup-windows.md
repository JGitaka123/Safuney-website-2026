# Setup runbook — PO's Windows machine

Everything here is copy-paste for **PowerShell**. Run the blocks in order. Each block says what it does
and how to tell it worked. Only two steps need you in a browser: `gh auth login` and `vercel login`.

## 1. Tools

Check what is installed:

```powershell
git --version; node --version; pnpm --version; gh --version; vercel --version
```

Install anything that printed an error (close and reopen PowerShell afterwards):

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id GitHub.cli -e
corepack enable
npm install -g pnpm vercel
```

Expected: Node **v22.x** (20.9 or newer works), pnpm **10.x**.

## 2. GitHub

```powershell
gh auth login
# choose: GitHub.com → HTTPS → Yes (authenticate git) → Login with a web browser
```

Clone the repository and install dependencies:

```powershell
cd $HOME
git clone https://github.com/JGitaka123/Safuney-website-2026.git
cd Safuney-website-2026
pnpm install
pnpm ci
```

Expected: the last line reads `placeholder-guard: OK`.

### 2a. Protect `main`

This stops direct pushes and force-pushes to `main` and requires CI to pass before a merge. Run once.

```powershell
@'
{
  "required_status_checks": { "strict": true, "contexts": ["Lint, typecheck, build, placeholder guard"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0, "require_code_owner_reviews": true },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
'@ | Set-Content -Encoding utf8 protection.json

gh api -X PUT repos/JGitaka123/Safuney-website-2026/branches/main/protection --input protection.json
Remove-Item protection.json
```

Expected: a JSON blob starting with `"url": "https://api.github.com/repos/..."`. If GitHub replies that
branch protection is not available, the repository is private on a free plan: make it public or upgrade,
then rerun.

## 3. Vercel — first production deploy

**Preferred: the dashboard (does the Git connection and root directory in one go).**

1. Open https://vercel.com/new (log in to **your** account).
2. Import `JGitaka123/Safuney-website-2026`.
3. Project name: `safuney-website-2026`.
4. Framework preset: **Next.js** (auto-detected).
5. **Root Directory: `apps/web`** ← important; click *Edit* next to Root Directory and type it.
6. Leave build settings default. Click **Deploy**.

Expected: a green "Congratulations" screen with a URL like `https://safuney-website-2026.vercel.app`.
Open it on your phone. From now on every pull request gets its own preview URL and every merge to `main`
redeploys production.

Then link your local clone to the project so `vercel env pull` works:

```powershell
vercel login
vercel link --yes --project safuney-website-2026
```

**Alternative: CLI only** (use if the dashboard import fails):

```powershell
vercel login
vercel link              # "Set up and deploy"? → N. Link to existing project? → N. Name: safuney-website-2026
vercel git connect       # connects the GitHub repo
```

Then set Root Directory to `apps/web` under Vercel → Project → Settings → General.

## 4. Managed services (needed before Phase 1, not before)

In Vercel → your project → **Storage** → *Create Database*:

- **Neon** (Postgres) → name `safuney-db` → connect to all environments.
- **Upstash** (Redis) → name `safuney-cache` → connect to all environments.

In Vercel → **Integrations** → Marketplace → **Resend** → add to this project.

Check the variables landed (names only, no values are printed):

```powershell
vercel env ls
```

Expected to see at least: `DATABASE_URL`, an Upstash/KV pair (`KV_REST_API_URL` + `KV_REST_API_TOKEN` or
`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`), and `RESEND_API_KEY`. Tell Claude the exact names
you see; the code will be written to match.

Pull them for local development (this file is git-ignored and must never be committed):

```powershell
vercel env pull apps/web/.env.local
```

## 5. Run the site locally

```powershell
pnpm dev
```

Open http://localhost:3000 — or on your phone on the same Wi-Fi, `http://<your PC's IP>:3000`.

## Done when

- `pnpm ci` passes locally.
- `https://safuney-website-2026*.vercel.app` opens on your phone.
- `gh api repos/JGitaka123/Safuney-website-2026/branches/main/protection` returns JSON, not an error.

## 6. Environment variables the site reads (Phase 1 onward)

Set these in Vercel → Project → Settings → Environment Variables (Production and Preview). Names only;
never paste values into chat or commit them.

| Variable | Set by | Used for |
| --- | --- | --- |
| `DATABASE_URL` | Neon integration | Catalogue, leads, orders. Without it the site still renders from static config and database features switch off. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL`, `KV_REST_API_TOKEN`) | Upstash integration | Rate limiting, sessions, cache. Without them an in-memory fallback is used (fine for previews, not for production). |
| `AUTH_SECRET` | All | Signs sign-in sessions. Generate once with `openssl rand -base64 32` (or `npx auth secret`); different value per environment. |
| `AUTH_SECRET` | All | Signs session tokens. Generate a different one per environment: `openssl rand -base64 32`. Sign-in is refused without it; the site still builds and browses. |
| `COMPANY_KRA_PIN` | All | Safuney's KRA PIN, printed on tax invoices (question 4). Invoices say "to be confirmed" until it is set. |
| `COMPANY_VAT_NUMBER` | All | VAT registration number for tax invoices, if separate from the PIN. |
| `DEMO_STAFF_PASSWORD` | Preview only | Password of the demo staff accounts the demo seed creates (`sales@`, `finance@`, `admin@safuney.test`). Never set in production; the seed refuses to run there. |
| `RESEND_API_KEY` | Resend integration | Contact-form and order emails. |
| `EMAIL_FROM` | you | Sender shown on emails, e.g. `Safuney <no-reply@safuney.com>`. The domain must be verified in Resend. |
| `LEADS_INBOX` | you | Where contact-form leads are delivered. Defaults to `info@safuney.com`. |
| `NEXT_PUBLIC_SITE_URL` | you (production only) | `https://safuney-website-2026.vercel.app` now; `https://safuney.com` after cut-over. Also the base for payment callbacks. |
| `PAYMENTS_MODE` | you (Preview only) | `mock` lets previews and CI run checkout without provider accounts. Never set on Production (the site refuses). |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY` | Safaricom Daraja app (sandbox first) | M-Pesa STK push and status query. |
| `MPESA_CALLBACK_SECRET` | you (any long random string) | Secret path segment on the callback URL; the site rejects callbacks without it. |
| `MPESA_ENV` | you | `sandbox` (default) or `production`. Production also enforces Safaricom's callback IP list. |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Paystack dashboard (test keys first) | Card payments; webhook signatures. |
| `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID` | Africa's Talking | Order SMS. `AT_USERNAME=sandbox` uses their sandbox. |
| `CRON_SECRET` | you (random string) | Protects the cron route that releases expired stock reservations (Vercel sets the header). |

After adding or changing variables, redeploy (Vercel → Deployments → ⋯ → Redeploy) and pull them
locally:

```powershell
vercel env pull apps/web/.env.local
```

## 7. Let CI test the preview URLs (optional but recommended)

Vercel protects preview deployments with a login by default, which stops the automated browser checks
from reaching them. Either:

- Vercel → Project → Settings → Deployment Protection → **Vercel Authentication** → *Only Production
  Deployments* (previews become public URLs, which is fine for this project), **or**
- keep protection on and create a bypass: Deployment Protection → **Protection Bypass for Automation**
  → generate. Then add it to GitHub:

```powershell
gh secret set VERCEL_AUTOMATION_BYPASS_SECRET --repo JGitaka123/Safuney-website-2026
# paste the value when prompted
```

## 8. Demo catalogue data on previews (never production)

Until the PO's price list is imported, every harvested product stays `needsPoReview=true` and is hidden.
For previews and CI, the seed can mark them reviewed with **illustrative** prices, stock and dilution
guidance so the shop can be exercised end to end:

```powershell
$env:SEED_DEMO = "1"; pnpm --filter @safuney/db seed
```

The seed refuses to do this when `VERCEL_ENV=production`. Every figure it writes is invented for
demonstration and is overwritten by the catalogue import (Phase 6).

## 9. Payment provider callbacks

Register these URLs with each provider once the site has its final address (they are relative to
`NEXT_PUBLIC_SITE_URL`):

| Provider | Setting | URL |
| --- | --- | --- |
| Safaricom Daraja | STK callback (set per request by the site) | `/api/payments/mpesa/callback/<MPESA_CALLBACK_SECRET>` |
| Safaricom Daraja | C2B validation / confirmation (Paybill without prompt) | same path, registered in Phase 5 |
| Paystack | Dashboard → Settings → Webhooks | `/api/payments/paystack/webhook` |

### Sign-in on previews and in CI

With `PAYMENTS_MODE=mock` the sign-in page shows the six-digit code on the page instead of sending an
SMS, and magic links are written to the server log. Real SMS needs `AT_API_KEY`/`AT_USERNAME`
(Africa's Talking); real links need `RESEND_API_KEY`. Staff sign in at `/sign-in/staff` with email,
password and an authenticator code; the demo seed creates `sales@safuney.test`, `finance@safuney.test`
and `admin@safuney.test` with `DEMO_STAFF_PASSWORD` (default `safuney-demo-2026`) and no second factor.

### Staff roles

`SALES` prices quotes (`/sales`), `FINANCE` decides credit (`/sales/credit`), `WAREHOUSE` runs the
board (`/warehouse`), `ADMIN` can do all of it. The demo seed creates one of each (`sales@`,
`finance@`, `warehouse@`, `admin@safuney.test`). Production staff accounts are created at
`/admin/staff` by an administrator: pick the role, set a first password, and have the person add the
authenticator code to their app **there and then** — it is shown once and cannot be shown again. Roles
carry permissions rather than page lists (`apps/web/lib/admin/permissions.ts`, ADR 0009), so a person
sees only the sections their desk needs.

Nobody can change their own role or switch off their own account, and the last active administrator
cannot be demoted — that is how a site ends up with no way back in. If it ever happens anyway, promote
someone directly in the database: `UPDATE "User" SET role = 'ADMIN', "isActive" = true WHERE email =
'…';`

### The admin console

`/admin` — overview, catalogue, orders, customers, content, leads, audit log, settings, staff. Two
things to do before launch:

1. **Correct the catalogue.** `/admin/catalogue` → *Export CSV*, fix names, packs and prices in a
   spreadsheet, then *Import CSV*. You see a row-by-row diff of exactly what would change before
   anything is written, and any bad row rejects the whole file (ADR 0010). Then publish each product
   with the *Needs review — publish* button; nothing unreviewed is visible to customers.
2. **Settings** (`/admin/settings`): the company KRA PIN and VAT number, which every tax invoice
   carries, and whether prices show including or excluding VAT.

Every change made in the console is recorded at `/admin/audit` with who made it and what it was
before.

### Cron jobs (Vercel)

**A Hobby account allows one run per day per job.** Anything more frequent is rejected at deploy time
with *"Hobby accounts are limited to daily cron jobs"* — and it fails the whole deployment, not just
the cron, so the site silently stops updating. That is what happened between Phase 3 and Phase 4.
Keep every schedule daily unless the account moves to Pro, and never rely on a cron for anything a
customer waits on: expired stock reservations are released on the read path as well (see
`apps/web/lib/orders/reservations.ts`), so the 30-minute hold is real whatever the plan allows.


`apps/web/vercel.json` registers two jobs, both protected by `CRON_SECRET`:
`/api/cron/release-reservations` every 10 minutes (stock held by unpaid orders; orders nobody approved
within seven days) and `/api/cron/scheduled-deliveries` daily at 07:00 Nairobi time (reminders three
days ahead, then the orders that are due).

### Mock payments on previews and in CI

With `PAYMENTS_MODE=mock` (never accepted in production) no provider is called. The M-Pesa pending
page, the card return page and the order tracking page show a dashed **Test controls** box with
"Simulate payment success" and "Simulate cancellation". Each button feeds a signed callback through
`/api/payments/mock/callback`, so the same verification, idempotency and status code runs as with a
real provider. The box is rendered by the server from `PAYMENTS_MODE` and does not exist in live mode.

An unpaid order can always be paid another way from its tracking link (M-Pesa ↔ card ↔ cash on
delivery); the order and its stock reservation are kept, only the payment method changes.

Sandbox test flow for M-Pesa: create an app at developer.safaricom.co.ke, copy the consumer key and
secret, use shortcode `174379` with the published sandbox passkey, set `MPESA_ENV=sandbox`, and place an
order on a preview with a Safaricom test number. Daraja needs a public HTTPS callback, which every
Vercel preview has.
