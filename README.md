# Safuney website 2026

The new website and online shop for **Safuney Limited**, Nairobi — supplier of professional cleaning and
hygiene chemicals and support services to institutional, hospitality, industrial, healthcare, foodservice
and education customers. This repository replaces the brochure site at https://safuney.com.

Status: **Phase 0.5 (holding page) / Phase 0 (discovery)**. See [`docs/`](docs/) for the plan and reports.

## Layout

```
apps/web/        Next.js (App Router, TypeScript strict, Tailwind) — the site
packages/        (from Phase 1) db (Prisma), payments, ui, config
scripts/         CI guards, e.g. placeholder-guard.mjs
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
pnpm dev          # http://localhost:3000
pnpm ci           # what CI runs: lint, typecheck, build, placeholder guard
```

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
- `pnpm guard:placeholders` scans the built output and source copy for template text ("Lorem", "Paragraph
  of text beneath the heading", "TODO" in shipped HTML, untranslated i18n keys) and fails the build.
- Paths listed in [`.github/CODEOWNERS`](.github/CODEOWNERS) (payments, database schema, checkout) need the
  product owner's review before merge.

Later phases add unit, integration (Neon branch per PR), Playwright + axe, and Lighthouse (≥ 95 mobile).

## Contributing conventions

- Branch per phase or ticket; one PR per phase. Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
- Money is integer minor units (KES cents). The server is the only price authority.
- Every write path ships with a test that fails before and passes after.
- Copy is real. Nothing that reads as a placeholder may be committed.

## Licence

Proprietary — see [`LICENSE`](LICENSE).
