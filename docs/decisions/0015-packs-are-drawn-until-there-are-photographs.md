# 0015 — Packs are drawn from catalogue data until there are photographs

**Status:** accepted, narrowed by [ADR 0016](0016-the-real-brand.md) · **Date:** 2026-09-10 · **Supersedes part of** design plan §8 (Imagery)

> **Narrowed 2026-09-10.** The PO's July 2024 catalogue turned out to carry a photograph of
> nearly every product, and those are now what the tiles and the hero show. The drawn pack is
> what remains for a product with no photograph — which is what this ADR always said it was.
> Everything below still holds for that case.

## Decision
Product tiles, the home hero and the share cards show a **drawn pack** rather than a flat square
carrying the product name. The container is derived from the variant's own `unit` and pack size — a 5 L
concentrate is a jerrican, a 500 ml sanitiser is a bottle, a 20 L bleach is a drum, a 15 kg destainer is
a pail, anything counted is a carton — and the label carries the real pack size and the product's zone
colour.

This overrides the plan's "no illustration" rule for this one case. Photography still replaces it the
day it exists: `PackShot` is what fills `ProductCard`'s `image` slot, not a replacement for it.

## Why
The plan's imagery rule said tiles show "a flat `ground-deep` square with the product name" until the
PO's photographs arrive, and banned illustration outright. That rule was right about what it was aimed
at — stock photography, abstract blobs, decorative icons — and wrong about its consequence.

A grid of grey squares does not read as restraint. It reads as a site that is not finished, which is
precisely the judgement the PO made on seeing it, and it is the judgement a buyer comparing us against
Arco or Ecolab would make in about two seconds. The home hero was worse: half the fold was reserved for
a photograph and therefore simply empty.

What makes this not a violation of the rule's intent is that **none of it is decorative**. Every line
comes from a field in the database. Change a variant's unit and the container changes. Change its zone
and the label changes colour. There is nothing to keep in sync by hand, nothing invented about a product,
and no stock image of somebody else's bottle standing in for ours.

## Consequences
- One `PackShot` component serves the product grid, the hero and (already) the generated Open Graph
  cards, so a shared link, a listing and the home page are made of the same material.
- `transparent` exists because an opaque white square is right inside a card frame and wrong in an
  overlapping group — the first hero build clipped two of the three pack labels.
- A product with real photography renders it and never reaches this code.
- The drawings are deliberately flat: outline, one accent fill, one shadow ellipse. No gradients or
  highlights, which keeps the plan's "stainless, not chrome" rule intact.

## Alternatives considered
- **Wait for photography.** It is a PO action with no date, and the site has to be presentable now.
- **Stock photography.** Someone else's bottle, licensing to manage, and a buyer can tell.
- **Keep the grey square.** Honest, and the specific thing that made the site look unfinished.
