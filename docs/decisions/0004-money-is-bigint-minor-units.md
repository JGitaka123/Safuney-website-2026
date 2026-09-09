# 0004 — Money is BigInt minor units end to end

**Status:** accepted · **Date:** 2026-09-09

## Decision
Every money column is `BigInt` (KES cents) in Postgres and `bigint` in TypeScript (`packages/db/src/money.ts`).
VAT and percentages are basis points (`Int`). Formatting to "KES 1,250.00" happens only at the edge.

## Why
Non-negotiable #2 forbids floats. A 32-bit `Int` tops out at KES 21,474,836.47, which an institutional
order or an annual spend statement can exceed. BigInt costs some friction at the RSC/JSON boundary
(`serializeMoney`/`deserializeMoney`) and buys correctness everywhere else.

## Consequences
- Client components receive money as decimal strings, never numbers.
- Tests in `packages/db/test/money.test.ts` pin rounding (half-up) and parsing behaviour.
