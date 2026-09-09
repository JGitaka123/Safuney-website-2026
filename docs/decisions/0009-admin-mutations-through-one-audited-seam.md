# 0009 — Every admin mutation goes through one audited seam

**Status:** accepted · **Date:** 2026-09-09

## Decision
Admin mutations are declared with `adminAction(name, permission, entity, handler)` in
`apps/web/lib/admin/action.ts`. The seam resolves the viewer, refuses anyone without the permission,
runs the handler, and writes the `AuditLog` row itself. Actions declare a **permission**, never a role;
roles are bundles of permissions in `apps/web/lib/admin/permissions.ts`.

## Why
Phase 6's gate is that every admin mutation has an authorisation test and an audit-log test. Written
per route, that is two tests per action written by hand, and the one that gets forgotten is the one
that matters — an unaudited mutation looks exactly like an audited one until someone needs to know who
changed a price.

The seam keeps a registry of what it has declared. One test iterates it and asserts that a customer, a
B2B buyer, an approver and every wrong staff role are all refused, so an action added later is covered
before anyone writes a test for it. An action that forgets to record what changed still gets a row with
its actor and entity, because the seam writes it rather than the handler.

Permissions rather than roles because the desks are not the permission boundaries. Finance and admin
both settle invoices; sales and admin both read customers. Encoding that as roles at each call site
means editing every action the first time the PO wants a stock clerk who may count stock but not set
prices.

## Consequences
- A mutation that does not go through the seam is a bug, and reviewable as one: it will not appear in
  `registeredActions()`.
- The audit row is written after the handler succeeds and inside the same request. A handler that
  throws writes nothing, because a refused change is not a change.
- Money is bigint (ADR 0004) and `JSON.stringify` throws on it, so the seam serialises bigints as
  strings. Audit rows therefore hold `"175050"`, not `175050`.
- The seam does not wrap the handler in a transaction. Handlers that need one open it themselves; a
  transaction spanning the audit write would hold a row lock for the length of the request.

## Alternatives considered
- **Per-route checks with a lint rule.** A lint rule can see that a check exists, not that it is the
  right one; it cannot check that the audit row describes the change.
- **Database triggers for the audit log.** They would catch writes from anywhere, which is genuinely
  better coverage, but they cannot record *who* — the actor is a session, not a database role — and
  the actor is the whole point.
