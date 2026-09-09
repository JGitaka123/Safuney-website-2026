# 0003 — ESLint pinned to 9.x

**Status:** accepted · **Date:** 2026-09-09

## Decision
`apps/web` pins `eslint@9.39.5`, not the current ESLint 10.

## Why
`eslint-config-next@16.3.4` depends on `eslint-plugin-import`, `eslint-plugin-react` and
`eslint-plugin-jsx-a11y`, whose peer ranges stop at ESLint 9. ESLint 10 installed with unmet-peer
warnings and is not supported by the Next config.

## Consequences
Revisit when `eslint-config-next` declares ESLint 10 support. `save-exact=true` in `.npmrc` keeps the pin.
