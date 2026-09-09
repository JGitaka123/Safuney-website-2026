# 0001 — pnpm workspace from the first commit

**Status:** accepted · **Date:** 2026-09-09

## Decision
Start the repository as a pnpm workspace (`apps/*`, `packages/*`) even though Phase 0.5 only contains
`apps/web`. Phase 1 adds `packages/db`, `packages/payments`, `packages/ui`, `packages/config`.

## Why
Restructuring a flat Next.js app into a monorepo later means moving every file, changing the Vercel
project's root directory and re-doing CI paths. Doing it now costs one `pnpm-workspace.yaml`.

## Consequences
- The Vercel project's **Root Directory** must be `apps/web` (see `docs/runbooks/setup-windows.md`).
- Root `package.json` scripts fan out with `pnpm -r`.
