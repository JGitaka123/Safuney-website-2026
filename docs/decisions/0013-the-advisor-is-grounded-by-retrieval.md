# 0013 — The advisor is grounded by retrieval and validated after generation

**Status:** accepted · **Date:** 2026-09-09

## Decision
The product advisor retrieves candidate products from the catalogue **first**, gives the model only
those products, and then **drops any product the model names that was not in that set**. If nothing
valid survives, it says so and records a lead. The model never sees a price, and it is never asked to
produce one.

## Why
The failure that matters here is not a clumsy answer. It is a confident recommendation for a product we
do not sell. A customer told to buy something that does not exist calls the office, is told the site was
wrong, and does not come back — and the damage is to the catalogue's credibility, not just to one sale.

Prompting alone does not prevent this. A system prompt saying "only recommend from this list" reduces
the rate; it does not make the failure impossible. So the constraint is enforced in code, after
generation, where it is a `Map.get` that either finds the slug or does not. The model cannot widen the
catalogue no matter what it returns, and a dropped recommendation is logged so drift is visible rather
than silent.

Prices are deliberately absent from what the model is given. The server is the price authority
(non-negotiable #1); a model that has seen a price can quote one, and a quoted price that differs from
checkout is worse than no advice at all.

The "nothing fits" path is the one that earns trust, so it is the first thing tested. It is also the most
commercially useful output the advisor produces: a customer telling us what we do not sell, or do not
describe well enough to be found.

## Consequences
- Answer quality is bounded by search quality. If retrieval misses a product, no prompt will recover it —
  which is the right trade, and an argument for the semantic search that Phase 8 deferred.
- The advisor is a server action, not a public API route: it costs money per call and must not be
  something anyone can point a script at. It is rate limited per IP, and the flag is re-checked in the
  action rather than trusted from the page.
- Without `ANTHROPIC_API_KEY` the feature degrades to a form that reaches a person. It does not pretend.
- Nine tests fix the behaviour by faking the API: an invented product is dropped, a mixed reply keeps only
  the real one, prices never appear in the request body, a failed call is admitted rather than papered
  over, and a fenced JSON block is tolerated.

## Alternatives considered
- **Trust the prompt.** Cheaper, and fails in exactly the way that costs the most.
- **Let the model call a search tool.** More flexible, more round trips, and it moves the grounding back
  inside the model's control.
