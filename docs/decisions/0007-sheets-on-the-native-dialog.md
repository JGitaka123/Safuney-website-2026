# 0007 — Sheets and overlays use the native `<dialog>`, not a dialog library

**Status:** accepted · **Date:** 2026-09-09

## Decision
The `Sheet` primitive in `packages/ui` (mobile navigation, header search, catalogue filters) is built on
the platform `<dialog>` element in modal mode. `@radix-ui/react-dialog` was removed.

## Why
Radix Dialog shipped 15 KB (compressed) of JavaScript to every page for a component that opens on
demand, and every kilobyte before first paint counts against the 2.0 s mobile LCP floor
(non-negotiable #7). A modal `<dialog>` gives the same guarantees natively: focus is trapped inside,
the rest of the page is inert, Escape closes, focus returns to the trigger on close, and it has the
`dialog` role with `aria-labelledby` for its name. Browser support is universal in the browsers the
site targets (Chrome, Safari and Firefox since 2022).

## Consequences
- Motion: the exit animation is driven by a `data-state="closing"` attribute and a 160 ms timer, not
  `animationend`, so reduced-motion users (whose animations are disabled) still get a closed dialog.
- The page behind a modal `<dialog>` can still scroll; the primitive locks `body` overflow while open.
- Playwright + axe cover the three sheets on the mobile project; keep them there when adding a sheet.

## Lighthouse measures real throttling, not the simulated model
Recorded here because it was found in the same review. Lighthouse's default "simulate" mode records an
unthrottled run on localhost and then models a slow network on top of it. On localhost the JavaScript
arrives and hydrates within ~150 ms, sometimes before the first paint, and whenever it does the model
charges the whole bundle against LCP: the same page reported 1.7 s or 2.3 s from one run to the next
(and in CI: 2003 ms, 2119 ms, 2532 ms for pages that measure 1.7–1.9 s). `lighthouserc.cjs` now uses
`throttlingMethod: "devtools"` (the same 4G-class network and 4× CPU profile, applied for real), which
measures the paint instead of modelling it: run-to-run spread is about ±50 ms. The gate is unchanged:
performance ≥ 0.95 and LCP ≤ 2000 ms on every key page.
