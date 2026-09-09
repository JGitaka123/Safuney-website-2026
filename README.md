# Safuney website 2026

The new website and online shop for **Safuney Limited**, Nairobi — supplier of professional cleaning and
hygiene chemicals and support services to institutional, hospitality, industrial, healthcare, foodservice
and education customers. This repository replaces the brochure site at https://safuney.com.

Status: **Phase 1 (foundation)** — design system, database schema, core pages, CI gates. See [`docs/reports/`](docs/reports/) for phase reports and [`docs/design/plan.md`](docs/design/plan.md) for the design plan.

## Layout

```
apps/web/        Next.js (App Router, TypeScript strict, Tailwind v4) — the site
packages/db/     Prisma 7 schema, migrations, seed, money helpers, integration tests
packages/ui/     Design-system primitives (Button, Sheet, ZoneBadge, ProductCard, …) shown at /design
packages/config/ Shared constants (VAT, Kenyan counties, phone normalisation) and tsconfig base
scripts/         prebuild (prisma generate + migrate deploy), placeholder guard, migrate check
docs/discovery/  Phase 0 — current-site inventory, content gaps, catalogue seed, PO questions
docs/design/     Phase 1 — design plan and photography guidelines
docs/decisions/  Architecture decision records
docs/runbooks/   Setup, launch, admin and catalogue-import runbooks
.github/         CI workflow and CODEOWNERS
```

## Run it locally (Windows, PowerShell)

Requires Node 22 LTS and pnpm. First-time machine setup is in
[`docs/runbooks/setup-windows.md`](docs/runbooks/setup-windows.md).

```powershell
pnpm install
pnpm --filter @safuney/db generate     # generate the Prisma client (git-ignored)
pnpm dev                                # http://localhost:3000
pnpm ci                                 # lint, typecheck, build, placeholder guard
pnpm test                               # unit + integration tests (integration needs DATABASE_URL)
pnpm test:e2e                           # Playwright + axe against a production build
```

A local Postgres works for development: set `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/safuney_dev`,
then `pnpm --filter @safuney/db migrate:deploy` and `pnpm --filter @safuney/db seed`.

Environment variables are never committed. Pull them from Vercel:

```powershell
vercel env pull apps/web/.env.local
```

## How it deploys

Vercel is connected to this GitHub repository (see the setup runbook):

- every pull request gets a **preview** deployment;
- merging to `main` deploys to **production** on the project's `*.vercel.app` URL;
- `safuney.com` is attached only in Phase 9, on the product owner's instruction.

The interim site sends `X-Robots-Tag: noindex` and a deny-all `robots.txt` so the `*.vercel.app` URL is
not indexed before cut-over.

## Rules enforced in CI

- `pnpm lint`, `pnpm typecheck`, `pnpm build` must pass.
- `pnpm migrate:check`: the migrations folder must fully describe `schema.prisma`.
- `pnpm test`: unit tests plus integration tests against a Postgres service (stock, append-only order
  events, payment idempotency, search vector, leads).
- `pnpm guard:placeholders` scans the built output and source copy for template text ("Lorem", "Paragraph
  of text beneath the heading", "TODO" in shipped HTML, untranslated i18n keys) and fails the build.
- Playwright + axe at a 360 px mobile viewport first, then desktop: every page, no horizontal overflow,
  zero WCAG 2.1 AA violations, keyboard navigation.
- Lighthouse CI on mobile: ≥ 95 on Performance, Accessibility, Best Practices and SEO; LCP < 2.0 s.
- A second workflow re-runs the browser suite against each Vercel preview URL when it is reachable.
- Paths listed in [`.github/CODEOWNERS`](.github/CODEOWNERS) (payments, database schema, checkout) need the
  product owner's review before merge.

## Contributing conventions

- Branch per phase or ticket; one PR per phase. Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
- Money is integer minor units (KES cents). The server is the only price authority.
- Every write path ships with a test that fails before and passes after.
- Copy is real. Nothing that reads as a placeholder may be committed.

## Licence

Proprietary — see [`LICENSE`](LICENSE).
