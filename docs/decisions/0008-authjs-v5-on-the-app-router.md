# 0008 — Sign-in with Auth.js v5 (App Router line), JWT sessions, no customer passwords

**Status:** accepted · **Date:** 2026-09-09

## Decision
`next-auth@5` (the App Router line, still tagged beta) with the Prisma adapter on the existing
`User`/`Account`/`Session`/`VerificationToken` models. Customers sign in with a six-digit code sent by
SMS (Africa's Talking) or email, or with an emailed one-time link (Resend). Staff sign in with email,
password (scrypt) and a TOTP code. Sessions are JWTs carrying only the user id and role; the account
pages read everything else from the database per request.

## Why
- The brief fixes Auth.js. `next-auth@4` (the "latest" tag) targets the pages router; v5 is the line
  that supports server components, server actions and Next 16.
- Codes and links suit the customers: most order from a phone, many share a mailbox, and nobody
  should have to remember another password. Staff keep a password plus a second factor because
  their accounts can change prices and see customer data.
- JWT rather than database sessions because the credentials providers (code, staff) only work with
  JWT sessions in Auth.js. The token holds nothing sensitive; a deactivated user is cut off at the
  next token refresh and on every account page (which re-reads `isActive`).
- Codes are stored as a keyed hash with an attempt counter; five wrong attempts burn the code. Both
  code and link requests are rate-limited per identifier with the existing limiter.

## Consequences
- `AUTH_SECRET` is required in every environment (runbook §6). Without it the sign-in routes fail
  closed; the shop still works for guests.
- Previews and CI (`PAYMENTS_MODE=mock`, never production) show the code on the page and log magic
  links, so the flow is testable without an SMS or email account.
- Sign-in merges the guest cart into the customer's cart (`CartService.mergeInto`) and sets a plain
  `sfn_signed_in` cookie that the static header reads to label the account link.
- When Auth.js v5 leaves beta the upgrade is a version bump; the API used here is the stable subset
  (`handlers`, `auth`, `signIn`, `signOut`, `jwt`/`session` callbacks).
