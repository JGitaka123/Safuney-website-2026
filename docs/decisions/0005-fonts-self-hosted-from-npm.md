# 0005 — IBM Plex is self-hosted from the @fontsource packages

**Status:** accepted · **Date:** 2026-09-09

## Decision
`next/font/local` loads IBM Plex Sans (400/500/600) and IBM Plex Mono (400/500) from
`@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` in `node_modules`, latin subset only.

## Why
`next/font/google` downloads at build time from fonts.googleapis.com, which some build environments
block and which makes every build depend on a third party. The npm packages are pinned, cached with the
lockfile, and produce identical `woff2` output. No request ever leaves the origin for fonts.

## Consequences
- Adding a weight means adding a `src` entry in `apps/web/app/fonts.ts`, not a Google Fonts URL.
- Swahili (Phase 7) needs no extra subset: Swahili uses the basic Latin alphabet.
