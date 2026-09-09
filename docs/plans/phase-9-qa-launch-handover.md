# Phase 9 plan — QA, launch, handover

**Date:** 2026-09-09 · **Status:** planned · Spec: master prompt §10 Phase 9.

## Scope
1. Full Playwright suite over every path a customer or member of staff can take.
2. **Adversarial pass**: price tampering, replayed callbacks, negative quantities, XSS in reviews and
   notes, IDOR on orders and invoices, rate limiting on OTP and checkout, coupon abuse.
3. Load: k6 against a preview (checkout p95 < 800 ms at 50 concurrent).
4. Launch runbook: DNS cut-over, Daraja go-live, Paystack live keys, monitoring, rollback.
5. Domain cut-over — **only on PO instruction**.
6. Post-launch seven-day watch.
7. Handover: an admin guide for non-technical staff, and a catalogue-import guide for the PO.

## What this phase is actually for
Everything before it added capability. This one tries to break what was added, writes down what a
person has to do at three in the morning, and hands the site to people who did not build it.

The adversarial pass is the centre. Each attack in the brief becomes a test that **fails if the defence
is removed** — not a note saying the defence exists. Where an attack succeeds, the fix ships in this
phase and the test stays as the regression.

## Order of work
1. **Adversarial suite first.** If it finds something, everything after it has to wait anyway.
2. Gaps in end-to-end coverage the adversarial pass exposes.
3. Load script (runnable against a preview; results depend on the PO's plan and are reported, not
   asserted in CI, because a Hobby preview is not production).
4. Runbooks and handover documentation.
5. Cut-over: **prepared, not performed.** The DNS change is the PO's to authorise, and the plan says so.

## What will not be done without the PO
- The domain cut-over itself, and re-registering payment callbacks on the final domain.
- Sentry: needs a DSN.
- Failed-payment alerts to the PO's phone: needs the Africa's Talking key.

Each gets a runbook section that is ready to execute the moment the credential exists.
