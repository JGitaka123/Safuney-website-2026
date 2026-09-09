# Phase 8 plan — features that put it in the top tier

**Date:** 2026-09-09 · **Status:** planned · Spec: master prompt §9 Phase 8.

Ten features, each behind a flag, each with a test and something the PO can actually click.

## What the environment allows, and what it doesn't
Three of the ten need a credential or an extension nobody has given me, and shipping an untestable
integration is worse than not shipping it. Where that is the case the plan says so and builds the part
that can be verified — the adapter, the flag, the degradation — rather than pretending.

| # | Feature | Status here | Why |
| - | ------- | ----------- | --- |
| 1 | AI product advisor | Built, flag-gated | Needs `ANTHROPIC_API_KEY`; the grounding, the refusal path and the lead capture are all testable without one. |
| 2 | Semantic search (Voyage + pgvector) | **Deferred** | `pgvector` is not available on this Postgres, so nothing about it could be verified. The existing search is already trigram + tsvector with typo tolerance. |
| 3 | Auto-replenishment subscriptions | Already shipped in Phase 4 | `SubscriptionService` with intervals, pause, skip and pre-charge reminders. Needs flag-gating and a demo, not a rebuild. |
| 4 | WhatsApp ordering | **Deferred** | Cloud API needs a Meta business account, a verified number and a webhook secret. None exist. |
| 5 | Facility hygiene planner | Built | Entirely self-contained: facility type and size in, consumption, kit and a schedule out. |
| 6 | Compliance hub | Built | `Document` versioning and `DocumentSubscription` are already in the schema. |
| 7 | PWA with offline browsing | Built | Self-contained. |
| 8 | Sales-rep mode | Built | Self-contained; GPS is the browser's own geolocation, with consent. |
| 9 | Loyalty / tiered volume pricing | Built | Rides on the existing price-list machinery. |
| 10 | Live stock and ETA | Built | Warehouse data already exists. |

## Flags
`FeatureFlag` already exists and `isFeatureEnabled` already reads it. Phase 8 adds an admin screen so
the PO turns each feature on themselves, and a convention: **a flag that is off means the feature is
not merely hidden but unreachable** — the route refuses, not just the link. A hidden link is not
access control, which is the same rule Phase 6 tests for the admin console.

Flags default to **off**. A feature nobody has demonstrated to the PO should not appear on the live
site because a deploy happened.

## Workstreams
### A. Flag administration
`/admin/flags`, ADMIN only, through the Phase 6 audited seam so turning a feature on is an audit-logged
act with a name against it.

### B. The advisor (1)
Server-side only. The catalogue is retrieved first and the model is given **only** those products; the
response is validated against the retrieved set, and any product it names that was not retrieved is
dropped rather than shown. If nothing fits, it says so and writes a lead — the "no product fits" path
is the one that earns trust, so it is tested first.

### C. Planner (5), compliance hub (6), live stock (10)
Self-contained pages over data that already exists.

### D. PWA (7), sales-rep mode (8), loyalty (9)
Manifest and a conservative service worker (never cache anything with a price or a session); a rep
surface for placing orders on behalf of a customer with a visit note; volume tiers that unlock without
anyone asking.

## Decisions to record
- ADR: the advisor is grounded by retrieval and validated after generation; it may never name a product
  that is not in the catalogue.
- ADR: the service worker caches no priced or personalised response.
