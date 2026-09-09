# 0005 — IBM Plex is self-hosted from the @fontsource packages

**Status:** accepted · **Date:** 2026-09-09

## Decision
IBM Plex Sans 400 and 600 and IBM Plex Mono 400 come from the `@fontsource` packages and are built by
`scripts/sync-fonts.mjs`: Sans is subset into a *core* range (ASCII, Latin-1, common punctuation) and an
*ext* range for rarer characters; Sans 600 core is inlined as a data URI in `font-critical.css` so every
heading, including the LCP element, renders in Plex from the first paint; Sans 400 core is preloaded and
uses `font-display: optional` (fallback for that page view if it is late, never a layout shift). There is
no 500 weight: `font-medium` resolves to 600 (`--font-weight-medium` in `globals.css`), which keeps one
fewer file off the critical path.

`next/font/local` was tried first; it preloads every declared weight, which pushed mobile LCP past
the 2.0 s floor on a simulated 4G profile. The metric-matched fallback it generated (Arial with
`size-adjust: 101.13%`, `ascent-override: 101.35%`, `descent-override: 27.19%`) is kept by hand.

## Why
`next/font/google` downloads at build time from fonts.googleapis.com, which some build environments
block and which makes every build depend on a third party. The npm packages are pinned, cached with the
lockfile, and produce identical `woff2` output. No request ever leaves the origin for fonts.

## Consequences
- Adding a face means extending `scripts/sync-fonts.mjs` and its `@font-face` rules; run
  `pnpm sync:fonts` (needs `pip install fonttools brotli`) and commit the output.
- The fontsource packages stay in `devDependencies` as the licensed source of truth.
- Swahili (Phase 7) needs no extra subset: Swahili uses the basic Latin alphabet.
